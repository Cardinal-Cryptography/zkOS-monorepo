use std::marker::PhantomData;

use futures::{SinkExt as _, StreamExt as _};
use serde::{Deserialize, Serialize};
use serde_json::Deserializer;
use tokio_util::codec::{FramedRead, FramedWrite, LengthDelimitedCodec};
use tokio_vsock::{OwnedReadHalf, OwnedWriteHalf, VsockAddr, VsockStream};

#[derive(thiserror::Error, Debug)]
pub enum VsockError {
    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),

    #[error("Serde error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("Connection closed")]
    Closed,
}

pub struct VsockClient<Req, Resp> {
    vsock: Vsock,
    _marker: PhantomData<(Req, Resp)>,
}

impl<'de, Req: Serialize, Resp: Deserialize<'de>> VsockClient<Req, Resp> {
    pub async fn new(cid: u32, port: u32) -> Result<Self, VsockError> {
        Ok(Self {
            vsock: Vsock::new(cid, port).await?,
            _marker: PhantomData,
        })
    }

    pub async fn request(&mut self, request: &Req) -> Result<Resp, VsockError> {
        self.vsock.send(request).await?;
        self.vsock.recv().await
    }
}

pub struct VsockServer<Req, Resp> {
    vsock: Vsock,
    _marker: PhantomData<(Req, Resp)>,
}

impl<'de, Req: Deserialize<'de>, Resp: Serialize> VsockServer<Req, Resp> {
    pub async fn handle_request<F: FnOnce(Req) -> Result<Resp, VsockError>>(
        &mut self,
        handler: F,
    ) -> Result<(), VsockError> {
        let req = self.vsock.recv().await?;
        let res = handler(req)?;
        self.vsock.send(&res).await?;
        Ok(())
    }
}

impl<Req, Resp> From<VsockStream> for VsockServer<Req, Resp> {
    fn from(value: VsockStream) -> Self {
        Self {
            vsock: value.into(),
            _marker: PhantomData,
        }
    }
}

struct Vsock {
    read: FramedRead<OwnedReadHalf, LengthDelimitedCodec>,
    write: FramedWrite<OwnedWriteHalf, LengthDelimitedCodec>,
}

impl From<VsockStream> for Vsock {
    fn from(connection: VsockStream) -> Self {
        let (read, write) = connection.into_split();
        let write = FramedWrite::new(write, LengthDelimitedCodec::new());
        let read = FramedRead::new(read, LengthDelimitedCodec::new());

        Self { write, read }
    }
}

impl Vsock {
    pub async fn new(cid: u32, port: u32) -> Result<Self, VsockError> {
        let connection = VsockStream::connect(VsockAddr::new(cid, port)).await?;
        Ok(connection.into())
    }

    pub async fn send<T: Serialize>(&mut self, msg: &T) -> Result<(), VsockError> {
        let msg = serde_json::to_vec(msg)?;
        self.write.send(msg.into()).await?;
        Ok(())
    }

    pub async fn recv<'de, T: Deserialize<'de>>(&mut self) -> Result<T, VsockError> {
        let msg = &self.read.next().await.ok_or(VsockError::Closed)??;
        let mut de = Deserializer::from_reader(msg.as_ref());
        let res = T::deserialize(&mut de)?;

        Ok(res)
    }
}

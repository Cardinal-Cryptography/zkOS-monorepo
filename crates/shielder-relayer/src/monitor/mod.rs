use std::{collections::HashMap, sync::Arc};

use shielder_contract::alloy_primitives::{Address, U256};
use tokio::sync::RwLock;

pub mod balance_monitor;
pub mod rpc_monitor;

pub type Balances = Arc<HashMap<Address, RwLock<Option<U256>>>>;

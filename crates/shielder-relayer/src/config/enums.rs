use std::str::FromStr;

use clap::ValueEnum;
#[derive(Copy, Clone, Eq, PartialEq, Debug, Default, ValueEnum)]
pub enum LoggingFormat {
    #[default]
    Text,
    Json,
}

impl FromStr for LoggingFormat {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "text" => Ok(Self::Text),
            "json" => Ok(Self::Json),
            _ => Err(()),
        }
    }
}

#[derive(Copy, Clone, Eq, PartialEq, Debug, Default, ValueEnum)]
pub enum NoncePolicy {
    #[default]
    Caching,
    Stateless,
}

impl FromStr for NoncePolicy {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "caching" => Ok(Self::Caching),
            "stateless" => Ok(Self::Stateless),
            _ => Err(()),
        }
    }
}

#[derive(Copy, Clone, Eq, PartialEq, Debug, Default, ValueEnum)]
pub enum DryRunning {
    #[default]
    Always,
    Optimistic,
}

impl FromStr for DryRunning {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "always" => Ok(Self::Always),
            "optimistic" => Ok(Self::Optimistic),
            _ => Err(()),
        }
    }
}

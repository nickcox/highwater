mod analysis;
mod api;
mod domain;
mod opencode;
mod pi;
mod pricing;
mod server;
mod source;

use clap::Parser;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    server::run(server::Args::parse()).await
}

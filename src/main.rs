mod analysis;
mod api;
mod domain;
mod pi;
mod server;

use clap::Parser;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    server::run(server::Args::parse()).await
}

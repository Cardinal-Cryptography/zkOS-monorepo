use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Reward::Table)
                    .if_not_exists()
                    .col(pk_auto(Reward::Id))
                    .col(string(Reward::User))
                    .col(decimal(Reward::Value))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Reward::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Reward {
    Table,
    Id,
    User,
    Value,
}

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExpenseProof {
    pub id: u32,
    pub owner: Address,
    pub hash: BytesN<32>,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    NextId,
    Expense(u32),
    UserExpenses(Address),
}

#[contract]
pub struct ProofSpendContract;

#[contractimpl]
impl ProofSpendContract {
    pub fn add_expense(env: Env, owner: Address, hash: BytesN<32>) -> u32 {
        owner.require_auth();

        let id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::NextId)
            .unwrap_or(1);

        let proof = ExpenseProof {
            id,
            owner: owner.clone(),
            hash,
            timestamp: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Expense(id), &proof);

        let mut user_expenses: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserExpenses(owner.clone()))
            .unwrap_or(Vec::new(&env));

        user_expenses.push_back(id);

        env.storage()
            .persistent()
            .set(&DataKey::UserExpenses(owner), &user_expenses);

        env.storage()
            .persistent()
            .set(&DataKey::NextId, &(id + 1));

        id
    }

    pub fn get_expense(env: Env, id: u32) -> Option<ExpenseProof> {
        env.storage()
            .persistent()
            .get(&DataKey::Expense(id))
    }

    pub fn get_user_expenses(env: Env, owner: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserExpenses(owner))
            .unwrap_or(Vec::new(&env))
    }

    pub fn verify_expense(env: Env, id: u32, hash: BytesN<32>) -> bool {
        let proof: Option<ExpenseProof> = env
            .storage()
            .persistent()
            .get(&DataKey::Expense(id));

        match proof {
            Some(expense) => expense.hash == hash,
            None => false,
        }
    }

    pub fn hello(env: Env) -> Vec<Symbol> {
        Vec::from_array(&env, [symbol_short!("Proof"), symbol_short!("Spend")])
    }
}
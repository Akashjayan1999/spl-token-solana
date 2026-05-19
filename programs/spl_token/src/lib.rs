use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken; // Needed for ATA creation
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("7Chp8SYqS2WDRvV1z7kR74ZwmTPrJxVAHmiuc2aspEpQ");

#[program]
pub mod spl_token {
    use super::*;

    pub fn initialize(ctx: Context<CreateMint>) -> Result<()> {
        let mint_amount = 100_000_000_000; // 100 tokens with 9 decimals
        let mint = ctx.accounts.new_mint.clone();
        let destination_ata = &ctx.accounts.new_ata;
        let authority = ctx.accounts.signer.clone();
        let token_program = ctx.accounts.token_program.clone();

        let mint_to_instruction = MintTo {
            mint: mint.to_account_info(),
            to: destination_ata.to_account_info(),
            authority: authority.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(token_program.to_account_info(), mint_to_instruction);
        token::mint_to(cpi_ctx, mint_amount)?;

        Ok(()) 
    }

        pub fn transfer_tokens(ctx: Context<TransferSpl>, amount: u64) -> Result<()> {
        let source_ata = &ctx.accounts.from_ata;
        let destination_ata = &ctx.accounts.to_ata;
        let authority = &ctx.accounts.from;
        let token_program = &ctx.accounts.token_program;

        // Transfer tokens from from_ata to to_ata
        let cpi_accounts = Transfer { // Transfer instruction
            from: source_ata.to_account_info().clone(),
            to: destination_ata.to_account_info().clone(),
            authority: authority.to_account_info().clone(),
        };
        let cpi_ctx = CpiContext::new(token_program.to_account_info(), cpi_accounts); // Create a CPI context
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    pub fn get_balance(ctx: Context<GetBalance>) -> Result<()> {
		// Get the token account address, its owner & balance
		let ata_pubkey = ctx.accounts.token_account.key();
		let owner = ctx.accounts.token_account.owner; // the `owner` is a field in the ATA
		let balance = ctx.accounts.token_account.amount; // the `amount` is a field in the ATA

		// Print the balance information
		msg!("Token Account Address: {}", ata_pubkey);
		msg!("Token Account Owner: {}", owner);
		msg!("Token Account Balance: {}", balance);
		Ok(())
}



}


#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        mint::decimals = 9,
        mint::authority = signer,

				// Commenting out or removing this line permanently disables the freeze authority.
				mint::freeze_authority = signer,
				// When a token is created without a freeze authority, Solana prevents any future updates to it.
				// This makes the token more decentralized, as no authority can freeze a user's ATA.

        seeds = [b"my_mint", signer.key().as_ref()],
        bump
    )]
    pub new_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = signer,
        associated_token::mint = new_mint,
        associated_token::authority = signer,
    )]
    pub new_ata: Account<'info, TokenAccount>,

		// This represents the SPL Token Program (TokenkegQfeZ…)
		// The same program we introduced in the previous article that owns and manages all mint and associated token account.
    pub token_program: Program<'info, Token>,
    // This represents the ATA program (ATokenGPvbdGV...)
    // As mentioned in the previous tutorial, it is only in charge of creating the ATA.
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferSpl<'info> {
    pub from: Signer<'info>,
    #[account(mut)]
    pub from_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>, // We are interacting with the Token Program
}


#[derive(Accounts)]
pub struct GetBalance<'info> {
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
}

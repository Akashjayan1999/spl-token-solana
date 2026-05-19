import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SplToken } from "../target/types/spl_token";
import * as splToken from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

describe("spl_token", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.splToken as Program<SplToken>;
  const provider = anchor.getProvider();
  const signerKp  = provider.wallet?.payer;
  const toKp =  new anchor.web3.Keypair();

  it("Creates a new mint and associated token account using CPI", async () => {
    // Derive the mint address using the same seeds ("my_mint" + signer public key) we used when the mint was created in our Anchor program
    const [mint] = PublicKey.findProgramAddressSync(
      [Buffer.from("my_mint"), signerKp!.publicKey.toBuffer()],
      program.programId
    );

    // Get the associated token account address
		// The boolean value here indicates whether the authority of the ATA is an "off-curve" address (i.e., a PDA).
		// A value of false means the owner is a normal wallet address.
		// `signerKp` is the owner here and it is a normal wallet address, so we use false.
    const ata = splToken.getAssociatedTokenAddressSync(mint, signerKp!.publicKey, false)

    // Call the create_mint instruction
    const tx = await program.methods
      .initialize()
      .accountsPartial({
        signer: signerKp!.publicKey,
        newMint: mint,
        newAta: ata,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Transaction signature:", tx);
    console.log("Token (Mint Account) Address:", mint.toString());
    console.log("Associated Token Account:", ata.toString());

    /// Verify the token details
    const mintInfo = await splToken.getMint(provider.connection, mint);
    assert.equal(mintInfo.decimals, 9, "Mint decimals should be 9");
    assert.equal(mintInfo.mintAuthority?.toString(), signerKp!.publicKey.toString(), "Mint authority should be the signer");
    assert.equal(mintInfo.freezeAuthority?.toString(), signerKp!.publicKey.toString(), "Freeze authority should be the signer");
    assert.equal(mintInfo.supply.toString(), "100000000000", "Supply should be 100 tokens (with 9 decimals)");

    // Verify the ATA details
    const tokenAccount = await splToken.getAccount(provider.connection, ata);
    assert.equal(tokenAccount.mint.toString(), mint.toString(), "Token account mint should match the mint PDA");
    assert.equal(tokenAccount.owner.toString(), signerKp!.publicKey.toString(), "Token account owner should be the signer");
    assert.equal(tokenAccount.amount.toString(), "100000000000", "Token balance should be 100 tokens (with 9 decimals)");
    assert.equal(tokenAccount.delegate, null, "Token account should not have a delegate");
  });

    it("Transfers tokens using CPI", async () => {
    // Derive the PDA for the mint
    const [mint] = PublicKey.findProgramAddressSync(
      [Buffer.from("my_mint"), signerKp!.publicKey.toBuffer()],
      program.programId
    );

    // Get the ATAs
    const fromAta = splToken.getAssociatedTokenAddressSync(mint, signerKp!.publicKey, false);
    const toAta = splToken.getAssociatedTokenAddressSync(mint, toKp.publicKey, false);

    // Create to_ata as it doesn't exist yet
    try {
      await splToken.createAssociatedTokenAccount(
        provider.connection,
        signerKp!,
        mint,
        toKp.publicKey
      );
    } catch (error) {
      throw new Error(error!.toString());
    }

    const transferAmount = new anchor.BN(10_000_000_000); // 10 tokens with 9 decimals

    // Transfer tokens
    const tx = await program.methods
      .transferTokens(transferAmount)
      .accountsPartial({
        from: signerKp!.publicKey,
        fromAta: fromAta,
        toAta: toAta,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Transfer Transaction signature:", tx);

    // Verify the transfer
    const toBalance = await provider.connection.getTokenAccountBalance(toAta);
    assert.equal(
      toBalance.value.amount,
      transferAmount.toString(),
      "Recipient balance should match transfer amount"
    );
  });

  it("Reads token balance using CPI", async () => {
    // Derive the PDA for the mint
    const [mint] = PublicKey.findProgramAddressSync(
      [Buffer.from("my_mint"), signerKp!.publicKey.toBuffer()],
      program.programId
    );

    // Get the associated token account address
    const ata = splToken.getAssociatedTokenAddressSync(mint, signerKp!.publicKey, false);

    // Call the get_balance instruction
    const tx = await program.methods
      .getBalance()
      .accounts({
        tokenAccount: ata,
      })
      .rpc();

    console.log("Get Balance Transaction signature:", tx);

    // Verify balance through direct query
    const balance = await provider.connection.getTokenAccountBalance(ata);
    assert.isTrue(balance?.value?.uiAmount ?? 0 > 0, "Token balance should be greater than 0");
  });



});

import ExpoModulesCore

// using [Uint8] instead of Data because Uint8Array -> Data in non-toplevel is not supported by bridge
// https://github.com/expo/expo/issues/27432
struct NewAccountPubInputs: Record {
  @Field
  var hNote: [UInt8]
  @Field
  var hId: [UInt8]
  @Field
  var initialDeposit: [UInt8]
  @Field
  var tokenAddress: [UInt8]
  @Field
  var anonymityRevokerPublicKeyX: [UInt8]
  @Field
  var anonymityRevokerPublicKeyY: [UInt8]
  @Field
  var symKeyEncryption1X: [UInt8]
  @Field
  var symKeyEncryption1Y: [UInt8]
  @Field
  var symKeyEncryption2X: [UInt8]
  @Field
  var symKeyEncryption2Y: [UInt8]
}

struct NewAccountAdvice: Record {
  @Field
  var id: [UInt8]
  @Field
  var nullifier: [UInt8]
  @Field
  var trapdoor: [UInt8]
  @Field
  var initialDeposit: [UInt8]
  @Field
  var tokenAddress: [UInt8]
  @Field
  var encryptionSalt: [UInt8]
  @Field
  var anonymityRevokerPublicKeyX: [UInt8]
  @Field
  var anonymityRevokerPublicKeyY: [UInt8]
}

struct DepositPubInputs: Record {
  @Field
  var idHiding: [UInt8]
  @Field
  var merkleRoot: [UInt8]
  @Field
  var hNullifierOld: [UInt8]
  @Field
  var hNoteNew: [UInt8]
  @Field
  var value: [UInt8]
  @Field
  var tokenAddress: [UInt8]
  @Field
  var macSalt: [UInt8]
  @Field
  var macCommitment: [UInt8]
}

struct DepositAdvice: Record {
  @Field
  var id: [UInt8]
  @Field
  var nonce: [UInt8]
  @Field
  var nullifierOld: [UInt8]
  @Field
  var trapdoorOld: [UInt8]
  @Field
  var accountBalanceOld: [UInt8]
  @Field
  var tokenAddress: [UInt8]
  @Field
  var path: [UInt8]
  @Field
  var value: [UInt8]
  @Field
  var nullifierNew: [UInt8]
  @Field
  var trapdoorNew: [UInt8]
  @Field
  var macSalt: [UInt8]
}

struct WithdrawPubInputs: Record {
  @Field
  var idHiding: [UInt8]
  @Field
  var merkleRoot: [UInt8]
  @Field
  var hNullifierOld: [UInt8]
  @Field
  var hNoteNew: [UInt8]
  @Field
  var value: [UInt8]
  @Field
  var tokenAddress: [UInt8]
  @Field
  var commitment: [UInt8]
  @Field
  var macSalt: [UInt8]
  @Field
  var macCommitment: [UInt8]
}

struct WithdrawAdvice: Record {
  @Field
  var id: [UInt8]
  @Field
  var nonce: [UInt8]
  @Field
  var nullifierOld: [UInt8]
  @Field
  var trapdoorOld: [UInt8]
  @Field
  var accountBalanceOld: [UInt8]
  @Field
  var tokenAddress: [UInt8]
  @Field
  var path: [UInt8]
  @Field
  var value: [UInt8]
  @Field
  var nullifierNew: [UInt8]
  @Field
  var trapdoorNew: [UInt8]
  @Field
  var commitment: [UInt8]
  @Field
  var macSalt: [UInt8]
}

struct ShielderActionSecretsStruct: Record {
  @Field
  var nullifier: [UInt8]
  @Field
  var trapdoor: [UInt8]
}

public class ShielderSdkCryptoMobileModule: Module {
  private var newAccountCircuit: NewAccountCircuit?
  private var depositCircuit: DepositCircuit?
  private var withdrawCircuit: WithdrawCircuit?
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ShielderSdkCryptoMobile')` in JavaScript.
    Name("ShielderSdkCryptoMobile")

    OnCreate() {
      self.newAccountCircuit = NewAccountCircuit.newPronto()
      self.depositCircuit = DepositCircuit.newPronto()
      self.withdrawCircuit = WithdrawCircuit.newPronto()
    }

    AsyncFunction("newAccountProve") { (advice: NewAccountAdvice) -> Data? in
      self.newAccountCircuit?.prove(
        id: Data(advice.id),
        nullifier: Data(advice.nullifier),
        trapdoor: Data(advice.trapdoor),
        initialDeposit: Data(advice.initialDeposit),
        tokenAddress: Data(advice.tokenAddress),
        encryptionSalt: Data(advice.encryptionSalt),
        anonymityRevokerPublicKeyX: Data(advice.anonymityRevokerPublicKeyX),
        anonymityRevokerPublicKeyY: Data(advice.anonymityRevokerPublicKeyY)
      )
    }

    AsyncFunction("newAccountVerify") { (pubInputs: NewAccountPubInputs, proof: [UInt8]) throws in
      try self.newAccountCircuit?.verify(
        hNote: Data(pubInputs.hNote),
        hId: Data(pubInputs.hId),
        initialDeposit: Data(pubInputs.initialDeposit),
        tokenAddress: Data(pubInputs.tokenAddress),
        anonymityRevokerPublicKeyX: Data(pubInputs.anonymityRevokerPublicKeyX),
        anonymityRevokerPublicKeyY: Data(pubInputs.anonymityRevokerPublicKeyY),
        symKeyEncryption1X: Data(pubInputs.symKeyEncryption1X),
        symKeyEncryption1Y: Data(pubInputs.symKeyEncryption1Y),
        symKeyEncryption2X: Data(pubInputs.symKeyEncryption2X),
        symKeyEncryption2Y: Data(pubInputs.symKeyEncryption2Y),
        proof: Data(proof)
      )
    }
    
    AsyncFunction("newAccountPubInputs") { (advice: NewAccountAdvice) -> NewAccountPubInputs in
      let pubInputsBytes = newAccountPubInputs(
        id: Data(advice.id),
        nullifier: Data(advice.nullifier),
        trapdoor: Data(advice.trapdoor),
        initialDeposit: Data(advice.initialDeposit),
        tokenAddress: Data(advice.tokenAddress),
        encryptionSalt: Data(advice.encryptionSalt),
        anonymityRevokerPublicKeyX: Data(advice.anonymityRevokerPublicKeyX),
        anonymityRevokerPublicKeyY: Data(advice.anonymityRevokerPublicKeyY)
      )
      
      var result = NewAccountPubInputs()
      result.hNote = [UInt8](pubInputsBytes.hashedNote)
      result.hId = [UInt8](pubInputsBytes.hashedId)
      result.initialDeposit = [UInt8](pubInputsBytes.initialDeposit)
      result.tokenAddress = [UInt8](pubInputsBytes.tokenAddress)
      result.anonymityRevokerPublicKeyX = [UInt8](pubInputsBytes.anonymityRevokerPublicKeyX)
      result.anonymityRevokerPublicKeyY = [UInt8](pubInputsBytes.anonymityRevokerPublicKeyY)
      result.symKeyEncryption1X = [UInt8](pubInputsBytes.symKeyEncryption1X)
      result.symKeyEncryption1Y = [UInt8](pubInputsBytes.symKeyEncryption1Y)
      result.symKeyEncryption2X = [UInt8](pubInputsBytes.symKeyEncryption2X)
      result.symKeyEncryption2Y = [UInt8](pubInputsBytes.symKeyEncryption2Y)
      return result
    }
    
    // Deposit circuit functions
    AsyncFunction("depositProve") { (advice: DepositAdvice) -> Data? in
      self.depositCircuit?.prove(
        id: Data(advice.id),
        nonce: Data(advice.nonce),
        nullifierOld: Data(advice.nullifierOld),
        trapdoorOld: Data(advice.trapdoorOld),
        accountBalanceOld: Data(advice.accountBalanceOld),
        tokenAddress: Data(advice.tokenAddress),
        path: Data(advice.path),
        value: Data(advice.value),
        nullifierNew: Data(advice.nullifierNew),
        trapdoorNew: Data(advice.trapdoorNew),
        macSalt: Data(advice.macSalt)
      )
    }
    
    AsyncFunction("depositVerify") { (pubInputs: DepositPubInputs, proof: [UInt8]) throws in
      try self.depositCircuit?.verify(
        idHiding: Data(pubInputs.idHiding),
        merkleRoot: Data(pubInputs.merkleRoot),
        hNullifierOld: Data(pubInputs.hNullifierOld),
        hNoteNew: Data(pubInputs.hNoteNew),
        value: Data(pubInputs.value),
        tokenAddress: Data(pubInputs.tokenAddress),
        macSalt: Data(pubInputs.macSalt),
        macCommitment: Data(pubInputs.macCommitment),
        proof: Data(proof)
      )
    }
    
    AsyncFunction("depositPubInputs") { (advice: DepositAdvice) -> DepositPubInputs in
      let pubInputsBytes = depositPubInputs(
        id: Data(advice.id),
        nonce: Data(advice.nonce),
        nullifierOld: Data(advice.nullifierOld),
        trapdoorOld: Data(advice.trapdoorOld),
        accountBalanceOld: Data(advice.accountBalanceOld),
        tokenAddress: Data(advice.tokenAddress),
        path: Data(advice.path),
        value: Data(advice.value),
        nullifierNew: Data(advice.nullifierNew),
        trapdoorNew: Data(advice.trapdoorNew),
        macSalt: Data(advice.macSalt)
      )
      
      var result = DepositPubInputs()
      result.idHiding = [UInt8](pubInputsBytes.idHiding)
      result.merkleRoot = [UInt8](pubInputsBytes.merkleRoot)
      result.hNullifierOld = [UInt8](pubInputsBytes.hNullifierOld)
      result.hNoteNew = [UInt8](pubInputsBytes.hNoteNew)
      result.value = [UInt8](pubInputsBytes.value)
      result.tokenAddress = [UInt8](pubInputsBytes.tokenAddress)
      result.macSalt = [UInt8](pubInputsBytes.macSalt)
      result.macCommitment = [UInt8](pubInputsBytes.macCommitment)
      return result
    }
    
    // Withdraw circuit functions
    AsyncFunction("withdrawProve") { (advice: WithdrawAdvice) -> Data? in
      self.withdrawCircuit?.prove(
        id: Data(advice.id),
        nonce: Data(advice.nonce),
        nullifierOld: Data(advice.nullifierOld),
        trapdoorOld: Data(advice.trapdoorOld),
        accountBalanceOld: Data(advice.accountBalanceOld),
        tokenAddress: Data(advice.tokenAddress),
        path: Data(advice.path),
        value: Data(advice.value),
        nullifierNew: Data(advice.nullifierNew),
        trapdoorNew: Data(advice.trapdoorNew),
        commitment: Data(advice.commitment),
        macSalt: Data(advice.macSalt)
      )
    }
    
    AsyncFunction("withdrawVerify") { (pubInputs: WithdrawPubInputs, proof: [UInt8]) throws in
      try self.withdrawCircuit?.verify(
        idHiding: Data(pubInputs.idHiding),
        merkleRoot: Data(pubInputs.merkleRoot),
        hNullifierOld: Data(pubInputs.hNullifierOld),
        hNoteNew: Data(pubInputs.hNoteNew),
        value: Data(pubInputs.value),
        commitment: Data(pubInputs.commitment),
        tokenAddress: Data(pubInputs.tokenAddress),
        macSalt: Data(pubInputs.macSalt),
        macCommitment: Data(pubInputs.macCommitment),
        proof: Data(proof)
      )
    }
    
    AsyncFunction("withdrawPubInputs") { (advice: WithdrawAdvice) -> WithdrawPubInputs in
      let pubInputsBytes = withdrawPubInputs(
        id: Data(advice.id),
        nonce: Data(advice.nonce),
        nullifierOld: Data(advice.nullifierOld),
        trapdoorOld: Data(advice.trapdoorOld),
        accountBalanceOld: Data(advice.accountBalanceOld),
        tokenAddress: Data(advice.tokenAddress),
        path: Data(advice.path),
        value: Data(advice.value),
        nullifierNew: Data(advice.nullifierNew),
        trapdoorNew: Data(advice.trapdoorNew),
        commitment: Data(advice.commitment),
        macSalt: Data(advice.macSalt)
      )
      
      var result = WithdrawPubInputs()
      result.idHiding = [UInt8](pubInputsBytes.idHiding)
      result.merkleRoot = [UInt8](pubInputsBytes.merkleRoot)
      result.hNullifierOld = [UInt8](pubInputsBytes.hNullifierOld)
      result.hNoteNew = [UInt8](pubInputsBytes.hNoteNew)
      result.value = [UInt8](pubInputsBytes.withdrawalValue)
      result.tokenAddress = [UInt8](pubInputsBytes.tokenAddress)
      result.commitment = [UInt8](pubInputsBytes.commitment)
      result.macSalt = [UInt8](pubInputsBytes.macSalt)
      result.macCommitment = [UInt8](pubInputsBytes.macCommitment)
      return result
    }
    
    // Hasher interface
    AsyncFunction("poseidonHash") { (input: [UInt8]) -> Data? in
      poseidonHash(inputs: Data(input))
    }
    
    AsyncFunction("poseidonRate") { () -> UInt32 in
      poseidonRate()
    }
    
    // SecretManager interface
    AsyncFunction("getSecrets") { (id: [UInt8], nonce: Int) -> ShielderActionSecretsStruct in
      let secrets = getActionSecrets(id: Data(id), nonce: UInt32(nonce))
      var result = ShielderActionSecretsStruct()
      result.nullifier = [UInt8](secrets.nullifier)
      result.trapdoor = [UInt8](secrets.trapdoor)
      return result
    }
    
    AsyncFunction("deriveId") { (privateKey: String, tokenAddress: String) -> Data? in
      deriveId(privateKeyHex: privateKey, tokenAddressHex: tokenAddress)
    }
    
    // Converter interface
    AsyncFunction("hex32ToScalar") { (hex: String) -> Data? in
      hex32ToF(hex: hex)
    }
    
    // NoteTreeConfig interface
    AsyncFunction("treeHeight") { () -> UInt32 in
      noteTreeHeight()
    }
    
    AsyncFunction("arity") { () -> UInt32 in
      noteTreeArity()
    }
  }
}

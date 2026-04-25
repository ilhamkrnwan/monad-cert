// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EduTrust
 * @author MonadCert Team
 * @notice Soulbound Token (SBT) protocol for decentralized credential verification
 * @dev Inherits ONLY ERC721 + Ownable to avoid ERC721URIStorage version conflicts.
 *      URI storage is implemented internally via _tokenURIs mapping.
 *
 * Key Properties:
 * - NON-TRANSFERABLE : Certificates are permanently bound to the recipient's wallet
 * - INSTITUTION-GATED: Only approved institutions can issue certificates
 * - ADMIN-REVOCABLE  : Owner can burn invalid/fraudulent certificates
 * - BATCH-OPTIMIZED  : batchIssueCertificate leverages Monad's parallel execution
 *
 * Deployment Target:
 * - Monad Testnet → Chain ID: 10143 | RPC: https://testnet-rpc.monad.xyz
 * - Monad Mainnet → Chain ID: 143   | RPC: https://rpc.monad.xyz
 */
contract EduTrust is ERC721, Ownable {

    // ================================================================
    //                        STATE VARIABLES
    // ================================================================

    /// @dev Internal counter — first minted token will have ID = 1
    uint256 private _tokenIdCounter;

    /// @dev Internal URI storage (replaces ERC721URIStorage extension)
    mapping(uint256 => string) private _tokenURIs;

    /// @notice True if the address is an approved institution
    mapping(address => bool) public isApprovedInstitution;

    /// @notice Maps tokenId → institution wallet that issued it
    mapping(uint256 => address) public issuedBy;

    /// @notice Maps tokenId → UNIX timestamp of issuance
    mapping(uint256 => uint256) public issuedAt;


    // ================================================================
    //                           EVENTS
    // ================================================================

    event InstitutionGranted(address indexed institution, address indexed grantedBy);
    event InstitutionRevoked(address indexed institution, address indexed revokedBy);
    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed institution,
        string  metadataURI,
        uint256 timestamp
    );
    event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy);


    // ================================================================
    //                        CUSTOM ERRORS
    // ================================================================

    error SBT_NonTransferable();
    error NotApprovedInstitution(address caller);
    error InvalidRecipientAddress();
    error InvalidInstitutionAddress();
    error BatchArrayLengthMismatch(uint256 recipientsLen, uint256 urisLen);
    error BatchCannotBeEmpty();


    // ================================================================
    //                         CONSTRUCTOR
    // ================================================================

    /**
     * @param initialOwner The Provider Admin wallet (MonadCert team)
     */
    constructor(address initialOwner)
        ERC721("EduTrust Credential", "EDUT")
        Ownable(initialOwner)
    {}


    // ================================================================
    //                    ADMIN FUNCTIONS (onlyOwner)
    // ================================================================

    /**
     * @notice Approves an institution to issue certificates on-chain
     * @param institution Wallet address of the institution to approve
     */
    function grantInstitution(address institution) external onlyOwner {
        if (institution == address(0)) revert InvalidInstitutionAddress();
        isApprovedInstitution[institution] = true;
        emit InstitutionGranted(institution, msg.sender);
    }

    /**
     * @notice Revokes an institution's right to issue new certificates
     * @dev Existing certificates issued by this institution remain VALID
     * @param institution Wallet address of the institution to revoke
     */
    function revokeInstitution(address institution) external onlyOwner {
        if (institution == address(0)) revert InvalidInstitutionAddress();
        isApprovedInstitution[institution] = false;
        emit InstitutionRevoked(institution, msg.sender);
    }

    /**
     * @notice Permanently burns (invalidates) a fraudulent or erroneous certificate
     * @dev IRREVERSIBLE. tokenId will no longer exist after this call.
     * @param tokenId The ID of the certificate to invalidate
     */
    function revokeCertificate(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
        emit CertificateRevoked(tokenId, msg.sender);
    }


    // ================================================================
    //                   INSTITUTION FUNCTIONS
    // ================================================================

    /**
     * @notice Issues a single SBT credential certificate to a recipient
     * @param recipient  Wallet address of the certificate recipient
     * @param uri        Metadata URI (Supabase Storage URL) for certificate JSON
     * @return tokenId   Unique ID of the newly minted certificate
     */
    function issueCertificate(address recipient, string calldata uri)
        external
        returns (uint256 tokenId)
    {
        if (!isApprovedInstitution[msg.sender]) revert NotApprovedInstitution(msg.sender);
        if (recipient == address(0)) revert InvalidRecipientAddress();

        tokenId = ++_tokenIdCounter;
        issuedBy[tokenId] = msg.sender;
        issuedAt[tokenId] = block.timestamp;

        _safeMint(recipient, tokenId);
        _tokenURIs[tokenId] = uri;

        emit CertificateIssued(tokenId, recipient, msg.sender, uri, block.timestamp);
    }

    /**
     * @notice Batch issues certificates to multiple recipients in ONE transaction
     * @dev Leverages Monad's parallel execution — ideal for graduation ceremonies.
     * @param recipients Array of recipient wallet addresses
     * @param uris       Array of metadata URIs (same length as recipients)
     * @return tokenIds  Array of newly minted token IDs (in order)
     */
    function batchIssueCertificate(
        address[] calldata recipients,
        string[]  calldata uris
    ) external returns (uint256[] memory tokenIds) {
        if (!isApprovedInstitution[msg.sender]) revert NotApprovedInstitution(msg.sender);
        if (recipients.length == 0) revert BatchCannotBeEmpty();
        if (recipients.length != uris.length)
            revert BatchArrayLengthMismatch(recipients.length, uris.length);

        uint256 batchSize = recipients.length;
        tokenIds = new uint256[](batchSize);

        for (uint256 i = 0; i < batchSize; ) {
            if (recipients[i] == address(0)) revert InvalidRecipientAddress();

            uint256 tokenId = ++_tokenIdCounter;
            issuedBy[tokenId]    = msg.sender;
            issuedAt[tokenId]    = block.timestamp;
            tokenIds[i]          = tokenId;

            _safeMint(recipients[i], tokenId);
            _tokenURIs[tokenId] = uris[i];

            emit CertificateIssued(tokenId, recipients[i], msg.sender, uris[i], block.timestamp);

            unchecked { ++i; }
        }
    }


    // ================================================================
    //                       VIEW / READ FUNCTIONS
    // ================================================================

    /**
     * @notice Returns full credential details for a given tokenId
     * @param tokenId    Certificate token ID to query
     * @return recipient    Wallet holding this certificate
     * @return institution  Institution that issued this certificate
     * @return uri          Metadata URI of the certificate
     * @return timestamp    UNIX timestamp of issuance
     * @return isValid      True if certificate exists and has not been revoked
     */
    function getCredential(uint256 tokenId)
        external
        view
        returns (
            address recipient,
            address institution,
            string  memory uri,
            uint256 timestamp,
            bool    isValid
        )
    {
        isValid = (_ownerOf(tokenId) != address(0));
        if (isValid) {
            recipient   = ownerOf(tokenId);
            institution = issuedBy[tokenId];
            uri         = _tokenURIs[tokenId];
            timestamp   = issuedAt[tokenId];
        }
    }

    /**
     * @notice Returns the metadata URI for a given tokenId (ERC-721 standard)
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        ownerOf(tokenId); // reverts with ERC721NonexistentToken if burned/invalid
        return _tokenURIs[tokenId];
    }

    /**
     * @notice Total certificates ever minted (counter never decrements on burn)
     */
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }


    // ================================================================
    //           SOULBOUND — TRANSFER RESTRICTION OVERRIDES
    // ================================================================

    /**
     * @dev Core SBT logic: blocks all token transfers between two non-zero addresses.
     *      - MINT  (from == address(0)) → ALLOWED
     *      - BURN  (to   == address(0)) → ALLOWED (admin revokeCertificate only)
     *      - TRANSFER (both non-zero)   → REVERTS SBT_NonTransferable
     *      Also cleans up _tokenURIs on burn to free storage.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert SBT_NonTransferable();
        }

        // Clean up URI storage when burning
        if (to == address(0)) {
            delete _tokenURIs[tokenId];
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Blocks approve() — SBTs cannot be approved for transfer
     */
    function approve(address, uint256) public pure override {
        revert SBT_NonTransferable();
    }

    /**
     * @dev Blocks setApprovalForAll() — SBTs cannot be approved for transfer
     */
    function setApprovalForAll(address, bool) public pure override {
        revert SBT_NonTransferable();
    }
}

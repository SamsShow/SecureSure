// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract InsuranceClaims is Ownable, ReentrancyGuard, Pausable {
    // Scaling factor for decimal handling (18 decimals like ETH)
    uint256 constant DECIMAL_PRECISION = 1e18;

    struct Claim {
        uint256 claimId;
        address payable claimant;
        uint256 claimAmount;  // Stored with 18 decimal places
        ClaimType claimType;
        ClaimStatus status;
        bool hospitalVerified;
        bool companyVerified;
        bool aiVerified;
        uint256 aiConfidenceScore;
        bool paid;
        string ipfsHash;
        string aiAnalysisHash;
        uint256 submissionTime;
        uint256 verificationDeadline;
        string rejectionReason;
        address assignedHospital;
        address assignedCompany;
        address assignedAiOracle;
    }


    struct UserProfile {
        uint256[] activeClaims;
        uint256[] historicalClaims;
        uint256 totalClaimsSubmitted;
        uint256 totalClaimsPaid;
        uint256 lastClaimTime;
        bool isBlacklisted;
    }

    struct Hospital {
        string name;
        bool isActive;
        uint256 totalVerifications;
        uint256 lastVerificationTime;
    }

    struct Company {
        string name;
        bool isActive;
        uint256 totalVerifications;
        uint256 lastVerificationTime;
    }

    enum ClaimType { MEDICAL, ACCIDENT, LIFE, PROPERTY, OTHER }
    enum ClaimStatus { PENDING, IN_REVIEW, APPROVED, REJECTED, DISPUTED, PAID }

    // State variables
    mapping(uint256 => Claim) public claims;
    mapping(address => UserProfile) public userProfiles;
    mapping(address => Hospital) public hospitals;
    mapping(address => Company) public companies;
    mapping(ClaimType => uint256) public claimTypeLimits;
    mapping(address => bool) public authorizedHospitals;
    mapping(address => bool) public authorizedCompanies;
    mapping(address => bool) public authorizedAiOracles;
    
    uint256 public totalClaims;
    uint256 public verificationTimeLimit;
    uint256 public minimumClaimAmount;  // Stored with 18 decimal places
    uint256 public maximumClaimAmount;  // Stored with 18 decimal places
    uint256 public contractBalance;     // Stored with 18 decimal places

    // Events
    event ContractFunded(address indexed funder, uint256 amount);  // amount in wei (18 decimals)
    event ClaimSubmitted(uint256 indexed claimId, address indexed claimant, uint256 claimAmount, string ipfsHash);
    event ClaimVerifiedByHospital(uint256 indexed claimId, address indexed hospital);
    event ClaimVerifiedByCompany(uint256 indexed claimId, address indexed company);
    event ClaimVerifiedByAi(uint256 indexed claimId, address indexed aiOracle, uint256 confidenceScore, string aiAnalysisHash);
    event AiVerificationFailed(uint256 indexed claimId, string reason);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);  // amount in wei
    event ClaimRejected(uint256 indexed claimId, string reason);
    event ClaimDisputed(uint256 indexed claimId, address indexed claimant);
    event HospitalAdded(address indexed hospital, string name);
    event CompanyAdded(address indexed company, string name);
    event AiOracleAdded(address indexed aiOracle);
    event UserBlacklisted(address indexed user);
    event EmergencyWithdrawal(address indexed recipient, uint256 amount);

    // Modifiers
    modifier validClaimAmount(uint256 _amount) {
        require(_amount >= minimumClaimAmount && _amount <= maximumClaimAmount, "Invalid claim amount");
        _;
    }

    modifier notBlacklisted() {
        require(!userProfiles[msg.sender].isBlacklisted, "User is blacklisted");
        _;
    }

    modifier claimExists(uint256 _claimId) {
        require(claims[_claimId].claimant != address(0), "Claim does not exist");
        _;
    }

    constructor(
        address _initialOwner,
        uint256 _verificationTimeLimit,
        uint256 _minimumClaimAmount,  // Input in wei
        uint256 _maximumClaimAmount   // Input in wei
    ) Ownable(_initialOwner) {
        verificationTimeLimit = _verificationTimeLimit;
        minimumClaimAmount = _minimumClaimAmount;
        maximumClaimAmount = _maximumClaimAmount;
    }

    // Funding function
    receive() external payable {
        contractBalance += msg.value;
        emit ContractFunded(msg.sender, msg.value);
    }

    // Core Functions
    function submitClaim(
        uint256 _claimAmount,  // Input in wei
        string memory _ipfsHash,
        ClaimType _claimType,
        address _hospital,
        address _aiOracle
    ) 
        public 
        whenNotPaused 
        notBlacklisted 
        validClaimAmount(_claimAmount)  
    {
        require(authorizedHospitals[_hospital], "Invalid hospital address");
        require(authorizedAiOracles[_aiOracle], "Invalid AI oracle address");
        require(
            userProfiles[msg.sender].lastClaimTime + 7 days < block.timestamp,
            "Must wait 7 days between claims"
        );

        uint256 claimId = uint256(keccak256(abi.encodePacked(msg.sender, block.timestamp, totalClaims)));
        
        claims[claimId] = Claim({
            claimId: claimId,
            claimant: payable(msg.sender),
            claimAmount: _claimAmount,
            claimType: _claimType,
            status: ClaimStatus.PENDING,
            hospitalVerified: false,
            companyVerified: false,
            aiVerified: false,
            aiConfidenceScore: 0,
            paid: false,
            ipfsHash: _ipfsHash,
            aiAnalysisHash: "",
            submissionTime: block.timestamp,
            verificationDeadline: block.timestamp + verificationTimeLimit,
            rejectionReason: "",
            assignedHospital: _hospital,
            assignedCompany: address(0),
            assignedAiOracle: _aiOracle
        });

        userProfiles[msg.sender].activeClaims.push(claimId);
        userProfiles[msg.sender].totalClaimsSubmitted++;
        userProfiles[msg.sender].lastClaimTime = block.timestamp;
        
        totalClaims++;
        
        emit ClaimSubmitted(claimId, msg.sender, _claimAmount, _ipfsHash);
    }

    function verifyClaimByHospital(uint256 _claimId) 
        public 
        whenNotPaused 
        claimExists(_claimId) 
    {
        require(authorizedHospitals[msg.sender], "Only authorized hospitals can verify claims");
        Claim storage claim = claims[_claimId];
        require(claim.assignedHospital == msg.sender, "Not assigned to this hospital");
        require(!claim.hospitalVerified, "Claim already verified by hospital");
        require(block.timestamp <= claim.verificationDeadline, "Verification deadline passed");

        claim.hospitalVerified = true;
        claim.status = ClaimStatus.IN_REVIEW;
        hospitals[msg.sender].totalVerifications++;
        hospitals[msg.sender].lastVerificationTime = block.timestamp;

        emit ClaimVerifiedByHospital(_claimId, msg.sender);
    }

    function verifyClaimByCompany(uint256 _claimId) 
        public 
        whenNotPaused 
        claimExists(_claimId) 
    {
        require(authorizedCompanies[msg.sender], "Only authorized companies can verify claims");
        Claim storage claim = claims[_claimId];
        require(claim.hospitalVerified, "Claim must be verified by hospital first");
        require(!claim.companyVerified, "Claim already verified by company");

        claim.companyVerified = true;
        claim.status = ClaimStatus.APPROVED;
        companies[msg.sender].totalVerifications++;
        companies[msg.sender].lastVerificationTime = block.timestamp;

        emit ClaimVerifiedByCompany(_claimId, msg.sender);
    }

    function verifyClaimByAi(
        uint256 _claimId,
        uint256 _confidenceScore,
        string memory _aiAnalysisHash
    ) 
        public 
        whenNotPaused 
        claimExists(_claimId) 
    {
        require(authorizedAiOracles[msg.sender], "Only authorized AI oracles can verify claims");
        require(_confidenceScore <= 100, "Confidence score must be between 0 and 100");
        
        Claim storage claim = claims[_claimId];
        require(claim.assignedAiOracle == msg.sender, "Not assigned to this AI oracle");
        require(!claim.aiVerified, "Claim already verified by AI");
        require(block.timestamp <= claim.verificationDeadline, "Verification deadline passed");

        claim.aiVerified = true;
        claim.aiConfidenceScore = _confidenceScore;
        claim.aiAnalysisHash = _aiAnalysisHash;

        if (_confidenceScore < 70) {
            claim.status = ClaimStatus.REJECTED;
            claim.rejectionReason = "Failed AI verification";
            emit AiVerificationFailed(_claimId, "Low confidence score");
        } else {
            claim.status = ClaimStatus.IN_REVIEW;
            emit ClaimVerifiedByAi(_claimId, msg.sender, _confidenceScore, _aiAnalysisHash);
        }
    }

    function payClaimToUser(uint256 _claimId) 
        public 
        onlyOwner 
        whenNotPaused 
        nonReentrant 
        claimExists(_claimId) 
    {
        Claim storage claim = claims[_claimId];
        require(claim.hospitalVerified && claim.companyVerified && claim.aiVerified, "Claim not fully verified");
        require(claim.aiConfidenceScore >= 70, "AI confidence score too low");
        require(!claim.paid, "Claim already paid");
        require(claim.status == ClaimStatus.APPROVED, "Claim not approved");
        require(address(this).balance >= claim.claimAmount, "Insufficient contract balance");

        claim.paid = true;
        claim.status = ClaimStatus.PAID;
        contractBalance -= claim.claimAmount;
        
        UserProfile storage profile = userProfiles[claim.claimant];
        profile.totalClaimsPaid++;
        
        removeFromActiveClaims(claim.claimant, _claimId);
        profile.historicalClaims.push(_claimId);

        (bool sent, ) = claim.claimant.call{value: claim.claimAmount}("");
        require(sent, "Failed to send funds");

        emit ClaimPaid(_claimId, claim.claimant, claim.claimAmount);
    }

    function weiToEther(uint256 _wei) public pure returns (uint256) {
        return _wei / DECIMAL_PRECISION;
    }

    // Helper function to convert ether to wei (for view functions if needed)
    function etherToWei(uint256 _ether) public pure returns (uint256) {
        return _ether * DECIMAL_PRECISION;
    }

    // Utility functions
    function addAuthorizedHospital(address _hospital, string memory _name) public onlyOwner {
        authorizedHospitals[_hospital] = true;
        hospitals[_hospital] = Hospital({ name: _name, isActive: true, totalVerifications: 0, lastVerificationTime: 0 });
        emit HospitalAdded(_hospital, _name);
    }

    function addAuthorizedCompany(address _company, string memory _name) public onlyOwner {
        authorizedCompanies[_company] = true;
        companies[_company] = Company({ name: _name, isActive: true, totalVerifications: 0, lastVerificationTime: 0 });
        emit CompanyAdded(_company, _name);
    }

    function addAuthorizedAiOracle(address _aiOracle) public onlyOwner {
        authorizedAiOracles[_aiOracle] = true;
        emit AiOracleAdded(_aiOracle);
    }

    function blacklistUser(address _user) public onlyOwner {
        userProfiles[_user].isBlacklisted = true;
        emit UserBlacklisted(_user);
    }

    function removeFromActiveClaims(address _user, uint256 _claimId) internal {
        uint256[] storage activeClaims = userProfiles[_user].activeClaims;
        for (uint256 i = 0; i < activeClaims.length; i++) {
            if (activeClaims[i] == _claimId) {
                activeClaims[i] = activeClaims[activeClaims.length - 1];
                activeClaims.pop();
                break;
            }
        }
    }

    function emergencyWithdraw() public onlyOwner whenPaused nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        contractBalance = 0;
        
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Failed to withdraw funds");

        emit EmergencyWithdrawal(msg.sender, balance);
    }

    function pauseContract() public onlyOwner {
        _pause();
    }

    function unpauseContract() public onlyOwner {
        _unpause();
    }
}

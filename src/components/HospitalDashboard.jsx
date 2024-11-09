import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  Hospital, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileCheck,
  Activity,
  Shield
} from 'lucide-react';
import contractABI from '../config/abi.json';
import { contractAddress } from '../config/contractAddress';

const HospitalDashboard = ({ userAddress }) => {
  const [contract, setContract] = useState(null);
  const [hospitalInfo, setHospitalInfo] = useState({
    isActive: false,
    totalVerifications: 0,
    lastVerificationTime: 'Never'
  });
  const [pendingClaims, setPendingClaims] = useState([]);
  const [verifiedClaims, setVerifiedClaims] = useState([]);
  const [loading, setLoading] = useState({
    contract: true,
    hospitalData: false,
    claims: false,
    verification: false
  });
  const [error, setError] = useState({
    contract: null,
    hospitalData: null,
    verification: null
  });

  // Initialize contract
  useEffect(() => {
    const initializeContract = async () => {
      try {
        // Check if window.ethereum is available
        if (!window.ethereum) {
          throw new Error("Please install MetaMask to use this dashboard");
        }

        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        // Create Web3Provider
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        // Create contract instance
        const hospitalContract = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );

        setContract(hospitalContract);
        setLoading(prev => ({ ...prev, contract: false }));
      } catch (err) {
        setError(prev => ({
          ...prev,
          contract: err.message || "Failed to initialize contract"
        }));
        setLoading(prev => ({ ...prev, contract: false }));
      }
    };

    initializeContract();
  }, []);

  // Listen for network changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
      window.ethereum.on('accountsChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  // Fetch hospital data and claims when contract is initialized
  useEffect(() => {
    if (contract && userAddress) {
      fetchHospitalData();
      fetchClaims();
    }
  }, [contract, userAddress]);

  const fetchHospitalData = async () => {
    setLoading(prev => ({ ...prev, hospitalData: true }));
    try {
      const [isActive, totalVerifications, lastVerificationTime] = await Promise.all([
        contract.isHospitalActive(userAddress),
        contract.getHospitalVerifications(userAddress),
        contract.getLastVerificationTime(userAddress)
      ]);

      setHospitalInfo({
        isActive,
        totalVerifications: totalVerifications.toNumber(),
        lastVerificationTime: lastVerificationTime.toNumber() === 0 
          ? 'Never' 
          : new Date(lastVerificationTime.toNumber() * 1000).toLocaleDateString()
      });
    } catch (err) {
      setError(prev => ({
        ...prev,
        hospitalData: "Failed to fetch hospital data"
      }));
    } finally {
      setLoading(prev => ({ ...prev, hospitalData: false }));
    }
  };

  const fetchClaims = async () => {
    setLoading(prev => ({ ...prev, claims: true }));
    try {
      const [pending, verified] = await Promise.all([
        contract.getPendingClaimsForHospital(userAddress),
        contract.getVerifiedClaimsForHospital(userAddress)
      ]);

      setPendingClaims(pending.map(claim => ({
        id: claim.id.toString(),
        claimant: claim.claimant,
        amount: claim.amount.toString(),
        timestamp: new Date(claim.timestamp.toNumber() * 1000).toLocaleDateString()
      })));

      setVerifiedClaims(verified.map(claim => ({
        id: claim.id.toString(),
        claimant: claim.claimant,
        amount: claim.amount.toString(),
        timestamp: new Date(claim.timestamp.toNumber() * 1000).toLocaleDateString()
      })));
    } catch (err) {
      setError(prev => ({
        ...prev,
        claims: "Failed to fetch claims"
      }));
    } finally {
      setLoading(prev => ({ ...prev, claims: false }));
    }
  };

  const formatEth = (value) => {
    return ethers.formatEther(value || '0');
  };

  const formatAddress = (address) => {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown';
  };

  const handleVerify = async (claimId) => {
    setLoading(prev => ({ ...prev, verification: true }));
    try {
      const tx = await contract.verifyClaimByHospital(claimId);
      await tx.wait();
      
      // Refresh data after verification
      await Promise.all([
        fetchHospitalData(),
        fetchClaims()
      ]);
    } catch (err) {
      setError(prev => ({
        ...prev,
        verification: err.message || "Failed to verify claim"
      }));
    } finally {
      setLoading(prev => ({ ...prev, verification: false }));
    }
  };

  // Show loading state while contract initializes
  if (loading.contract) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Clock className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Initializing dashboard...</p>
      </div>
    );
  }

  // Show error state if contract initialization failed
  if (error.contract) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error.contract}</p>
        </div>
      </div>
    );
  }

  // Rest of the component remains the same...
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Hospital Profile Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Hospital Dashboard</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            hospitalInfo.isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {hospitalInfo.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-4">
            <Shield className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Hospital Address</p>
              <p className="text-xl">{formatAddress(userAddress)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Activity className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm font-medium">Total Verifications</p>
              <p className="text-xl">{hospitalInfo.totalVerifications}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Clock className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm font-medium">Last Verification</p>
              <p className="text-sm">{hospitalInfo.lastVerificationTime}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Claims */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <h3 className="text-xl font-semibold">Pending Claims</h3>
          </div>
          <div className="space-y-4">
            {pendingClaims.map(claim => (
              <div key={claim.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">Claim #{claim.id}</p>
                    <p className="text-sm text-gray-500">
                      Claimant: {formatAddress(claim.claimant)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Amount: {formatEth(claim.amount)} ETH
                    </p>
                  </div>
                  <button
                    onClick={() => handleVerify(claim.id)}
                    disabled={loading.verification}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading.verification ? (
                      <Clock className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Verify
                  </button>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Pending Verification
                </span>
              </div>
            ))}
            {pendingClaims.length === 0 && (
              <p className="text-center text-gray-500">No pending claims</p>
            )}
          </div>
        </div>

        {/* Verified Claims */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="w-5 h-5 text-green-500" />
            <h3 className="text-xl font-semibold">Verified Claims</h3>
          </div>
          <div className="space-y-4">
            {verifiedClaims.map(claim => (
              <div key={claim.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">Claim #{claim.id}</p>
                    <p className="text-sm text-gray-500">
                      Claimant: {formatAddress(claim.claimant)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Amount: {formatEth(claim.amount)} ETH
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Verified
                </span>
              </div>
            ))}
            {verifiedClaims.length === 0 && (
              <p className="text-center text-gray-500">No verified claims</p>
            )}
          </div>
        </div>
      </div>

      {/* Error Alerts */}
      {Object.entries(error).map(([key, message]) => 
        message && (
          <div key={key} className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{message}</p>
          </div>
        )
      )}
    </div>
  );
};

export default HospitalDashboard;
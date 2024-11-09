import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import { contractAddress } from '../config/contractAddress';
import abi from '../config/abi.json';
import NavbarAdmin from './NavbarAdmin';

const AdminPage = () => {
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [aiOracle, setAiOracle] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState({});

  useEffect(() => {
    const initializeEthers = async () => {
      try {
        if (window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const tempSigner = await provider.getSigner();
          setSigner(tempSigner);
          const contractInstance = new ethers.Contract(
            contractAddress,
            abi,
            tempSigner
          );
          setContract(contractInstance);
        } else {
          showNotification('error', 'Metamask is not installed');
        }
      } catch (error) {
        showNotification('error', 'Error initializing ethers: ' + error.message);
      }
    };

    initializeEthers();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleTransaction = async (operation, params = []) => {
    setLoading(prev => ({ ...prev, [operation]: true }));
    try {
      if (!contract) throw new Error("Contract not initialized");
      const tx = await contract[operation](...params);
      await tx.wait();
      showNotification('success', `${operation} completed successfully`);
      
      // Clear form fields after successful transaction
      if (operation === 'addAuthorizedCompany') {
        setCompanyAddress('');
        setCompanyName('');
      } else if (operation === 'addAuthorizedHospital') {
        setHospitalAddress('');
        setHospitalName('');
      }
    } catch (error) {
      showNotification('error', `Error with ${operation}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [operation]: false }));
    }
  };

  const Card = ({ title, children, icon: Icon }) => (
    <motion.div 
      className="bg-white rounded-xl shadow-lg p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-5 h-5 text-blue-500" />}
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </motion.div>
  );

  const Input = ({ value, onChange, placeholder }) => (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
    />
  );

  const Button = ({ onClick, children, variant = 'primary', className = '', isLoading }) => {
    const baseStyles = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
    const variants = {
      primary: "bg-blue-500 text-white hover:bg-blue-600",
      warning: "bg-yellow-500 text-white hover:bg-yellow-600",
      danger: "bg-red-500 text-white hover:bg-red-600",
      secondary: "bg-gray-500 text-white hover:bg-gray-600"
    };

    return (
      <button 
        onClick={onClick}
        disabled={isLoading}
        className={`${baseStyles} ${variants[variant]} ${className} ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
        ) : children}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <NavbarAdmin />
      
      <div className="container mx-auto p-8">
        <motion.div 
          className="bg-white rounded-xl shadow-lg p-6 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2"></p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="AI Oracle Management">
            <div className="space-y-4">
              <Input
                value={aiOracle}
                onChange={(e) => setAiOracle(e.target.value)}
                placeholder="Enter AI Oracle address"
              />
              <Button 
                onClick={() => handleTransaction('addAuthorizedAiOracle', [aiOracle])}
                isLoading={loading.addAuthorizedAiOracle}
              >
                Add AI Oracle
              </Button>
            </div>
          </Card>

          <Card title="Company Management">
            <div className="space-y-4">
              <Input
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Enter Company address"
              />
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter Company name"
              />
              <Button 
                onClick={() => handleTransaction('addAuthorizedCompany', [companyAddress, companyName])}
                isLoading={loading.addAuthorizedCompany}
              >
                Add Company
              </Button>
            </div>
          </Card>

          <Card title="Hospital Management">
            <div className="space-y-4">
              <Input
                value={hospitalAddress}
                onChange={(e) => setHospitalAddress(e.target.value)}
                placeholder="Enter Hospital address"
              />
              <Input
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="Enter Hospital name"
              />
              <Button 
                onClick={() => handleTransaction('addAuthorizedHospital', [hospitalAddress, hospitalName])}
                isLoading={loading.addAuthorizedHospital}
              >
                Add Hospital
              </Button>
            </div>
          </Card>

          <Card title="Ownership Management">
            <div className="space-y-4">
              <Input
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="Enter new owner address"
              />
              <Button 
                variant="warning"
                onClick={() => handleTransaction('transferOwnership', [newOwner])}
                isLoading={loading.transferOwnership}
              >
                Transfer Ownership
              </Button>
            </div>
          </Card>
        </div>

        <motion.div 
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="danger"
            onClick={() => handleTransaction('emergencyWithdraw')}
            isLoading={loading.emergencyWithdraw}
          >
            Emergency Withdrawal
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleTransaction('pauseContract')}
            isLoading={loading.pauseContract}
          >
            Pause Contract
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleTransaction('unpauseContract')}
            isLoading={loading.unpauseContract}
          >
            Unpause Contract
          </Button>
        </motion.div>

        {notification && (
          <motion.div
            className="fixed bottom-4 right-4 max-w-md"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <div className={`p-4 rounded-lg shadow-lg ${
              notification.type === 'error' 
                ? 'bg-red-500 text-white' 
                : 'bg-green-500 text-white'
            }`}>
              {notification.message}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
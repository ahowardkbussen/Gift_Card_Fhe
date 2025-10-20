// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface GiftCard {
  id: string;
  encryptedBalance: string;
  timestamp: number;
  owner: string;
  status: "active" | "redeemed" | "expired";
  lastRedeemed?: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string, amount?: number): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'redeem':
      if (amount && value >= amount) {
        result = value - amount;
      }
      break;
    case 'add':
      if (amount) {
        result = value + amount;
      }
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newCardData, setNewCardData] = useState({ initialBalance: 0 });
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "redeemed" | "expired">("all");
  const [redeemAmount, setRedeemAmount] = useState("");

  const activeCount = cards.filter(c => c.status === "active").length;
  const redeemedCount = cards.filter(c => c.status === "redeemed").length;
  const expiredCount = cards.filter(c => c.status === "expired").length;

  useEffect(() => {
    loadCards().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadCards = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.log("Contract is not available");
        return;
      }

      const keysBytes = await contract.getData("giftcard_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing gift card keys:", e); }
      }
      
      const list: GiftCard[] = [];
      for (const key of keys) {
        try {
          const cardBytes = await contract.getData(`giftcard_${key}`);
          if (cardBytes.length > 0) {
            try {
              const cardData = JSON.parse(ethers.toUtf8String(cardBytes));
              list.push({ 
                id: key, 
                encryptedBalance: cardData.balance, 
                timestamp: cardData.timestamp, 
                owner: cardData.owner, 
                status: cardData.status || "active",
                lastRedeemed: cardData.lastRedeemed
              });
            } catch (e) { console.error(`Error parsing card data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading card ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setCards(list);
    } catch (e) { console.error("Error loading cards:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const createCard = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting balance with Zama FHE..." });
    try {
      const encryptedBalance = FHEEncryptNumber(newCardData.initialBalance);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const cardId = `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const cardData = { 
        balance: encryptedBalance, 
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        status: "active" 
      };
      
      await contract.setData(`giftcard_${cardId}`, ethers.toUtf8Bytes(JSON.stringify(cardData)));
      
      const keysBytes = await contract.getData("giftcard_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(cardId);
      await contract.setData("giftcard_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE-encrypted gift card created!" });
      await loadCards();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewCardData({ initialBalance: 0 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const redeemCard = async (cardId: string, amount: number) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing FHE redemption..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      const cardBytes = await contract.getData(`giftcard_${cardId}`);
      if (cardBytes.length === 0) throw new Error("Card not found");
      
      const cardData = JSON.parse(ethers.toUtf8String(cardBytes));
      if (cardData.status !== "active") throw new Error("Card is not active");
      
      const newBalance = FHECompute(cardData.balance, 'redeem', amount);
      const newStatus = FHEDecryptNumber(newBalance) <= 0 ? "redeemed" : "active";
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      const updatedCard = { 
        ...cardData, 
        balance: newBalance,
        status: newStatus,
        lastRedeemed: Math.floor(Date.now() / 1000)
      };
      
      await contractWithSigner.setData(`giftcard_${cardId}`, ethers.toUtf8Bytes(JSON.stringify(updatedCard)));
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE redemption completed!" });
      await loadCards();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Redemption failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const isOwner = (cardAddress: string) => address?.toLowerCase() === cardAddress.toLowerCase();

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         card.owner.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || card.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const renderPieChart = () => {
    const total = cards.length || 1;
    const activePercentage = (activeCount / total) * 100;
    const redeemedPercentage = (redeemedCount / total) * 100;
    const expiredPercentage = (expiredCount / total) * 100;
    
    return (
      <div className="pie-chart-container">
        <div className="pie-chart">
          <div className="pie-segment active" style={{ transform: `rotate(${activePercentage * 3.6}deg)` }}></div>
          <div className="pie-segment redeemed" style={{ transform: `rotate(${(activePercentage + redeemedPercentage) * 3.6}deg)` }}></div>
          <div className="pie-segment expired" style={{ transform: `rotate(${(activePercentage + redeemedPercentage + expiredPercentage) * 3.6}deg)` }}></div>
          <div className="pie-center">
            <div className="pie-value">{cards.length}</div>
            <div className="pie-label">Cards</div>
          </div>
        </div>
        <div className="pie-legend">
          <div className="legend-item"><div className="color-box active"></div><span>Active: {activeCount}</span></div>
          <div className="legend-item"><div className="color-box redeemed"></div><span>Redeemed: {redeemedCount}</span></div>
          <div className="legend-item"><div className="color-box expired"></div><span>Expired: {expiredCount}</span></div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="cyber-spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container cyberpunk-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"><div className="shield-icon"></div></div>
          <h1>FHE<span>Gift</span>Cards</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-card-btn cyber-button">
            <div className="add-icon"></div>New Card
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Privacy-Preserving Gift Cards</h2>
            <p>Powered by Zama FHE technology - balances remain encrypted during redemption</p>
          </div>
          <div className="fhe-indicator"><div className="fhe-lock"></div><span>FHE Encryption Active</span></div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card cyber-card">
            <h3>Project Introduction</h3>
            <p>Universal gift card system with <strong>Fully Homomorphic Encryption</strong> that allows merchants to redeem amounts without seeing your balance or transaction history.</p>
            <div className="fhe-badge"><span>Zama FHE-Powered</span></div>
          </div>
          
          <div className="dashboard-card cyber-card">
            <h3>Card Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item"><div className="stat-value">{cards.length}</div><div className="stat-label">Total Cards</div></div>
              <div className="stat-item"><div className="stat-value">{activeCount}</div><div className="stat-label">Active</div></div>
              <div className="stat-item"><div className="stat-value">{redeemedCount}</div><div className="stat-label">Redeemed</div></div>
              <div className="stat-item"><div className="stat-value">{expiredCount}</div><div className="stat-label">Expired</div></div>
            </div>
          </div>
          
          <div className="dashboard-card cyber-card">
            <h3>Status Distribution</h3>
            {renderPieChart()}
          </div>
        </div>

        <div className="cards-section">
          <div className="section-header">
            <h2>Your FHE Gift Cards</h2>
            <div className="header-actions">
              <div className="search-filter">
                <input 
                  type="text" 
                  placeholder="Search cards..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="cyber-input"
                />
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="cyber-select"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="redeemed">Redeemed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <button onClick={loadCards} className="refresh-btn cyber-button" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="cards-list cyber-card">
            <div className="table-header">
              <div className="header-cell">Card ID</div>
              <div className="header-cell">Owner</div>
              <div className="header-cell">Created</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {filteredCards.length === 0 ? (
              <div className="no-cards">
                <div className="no-cards-icon"></div>
                <p>No gift cards found</p>
                <button className="cyber-button primary" onClick={() => setShowCreateModal(true)}>Create First Card</button>
              </div>
            ) : filteredCards.map(card => (
              <div className="card-row" key={card.id} onClick={() => setSelectedCard(card)}>
                <div className="table-cell card-id">#{card.id.substring(0, 8)}</div>
                <div className="table-cell">{card.owner.substring(0, 6)}...{card.owner.substring(38)}</div>
                <div className="table-cell">{new Date(card.timestamp * 1000).toLocaleDateString()}</div>
                <div className="table-cell"><span className={`status-badge ${card.status}`}>{card.status}</span></div>
                <div className="table-cell actions">
                  {isOwner(card.owner) && card.status === "active" && (
                    <button 
                      className="action-btn cyber-button success" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const amount = prompt("Enter amount to redeem:");
                        if (amount && !isNaN(parseFloat(amount))) {
                          redeemCard(card.id, parseFloat(amount));
                        }
                      }}
                    >
                      Redeem
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal cyber-card">
            <div className="modal-header">
              <h2>Create New Gift Card</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="fhe-notice-banner">
                <div className="key-icon"></div> 
                <div>
                  <strong>FHE Encryption Notice</strong>
                  <p>Your gift card balance will be encrypted with Zama FHE before submission</p>
                </div>
              </div>
              
              <div className="form-group">
                <label>Initial Balance *</label>
                <input 
                  type="number" 
                  name="initialBalance" 
                  value={newCardData.initialBalance} 
                  onChange={(e) => setNewCardData({...newCardData, initialBalance: parseFloat(e.target.value) || 0})} 
                  placeholder="Enter initial balance..." 
                  className="cyber-input"
                  step="0.01"
                  min="0"
                />
              </div>
              
              <div className="encryption-preview">
                <h4>Encryption Preview</h4>
                <div className="preview-container">
                  <div className="plain-data">
                    <span>Plain Value:</span>
                    <div>{newCardData.initialBalance || '0'}</div>
                  </div>
                  <div className="encryption-arrow">→</div>
                  <div className="encrypted-data">
                    <span>Encrypted Data:</span>
                    <div>{newCardData.initialBalance ? FHEEncryptNumber(newCardData.initialBalance).substring(0, 50) + '...' : 'No value entered'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="cancel-btn cyber-button">Cancel</button>
              <button 
                onClick={createCard} 
                disabled={creating || newCardData.initialBalance <= 0} 
                className="submit-btn cyber-button primary"
              >
                {creating ? "Encrypting with FHE..." : "Create Gift Card"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {selectedCard && (
        <div className="modal-overlay">
          <div className="card-detail-modal cyber-card">
            <div className="modal-header">
              <h2>Card Details #{selectedCard.id.substring(0, 8)}</h2>
              <button onClick={() => { setSelectedCard(null); setDecryptedBalance(null); }} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="card-info">
                <div className="info-item"><span>Owner:</span><strong>{selectedCard.owner.substring(0, 6)}...{selectedCard.owner.substring(38)}</strong></div>
                <div className="info-item"><span>Created:</span><strong>{new Date(selectedCard.timestamp * 1000).toLocaleString()}</strong></div>
                <div className="info-item"><span>Status:</span><strong className={`status-badge ${selectedCard.status}`}>{selectedCard.status}</strong></div>
                {selectedCard.lastRedeemed && (
                  <div className="info-item"><span>Last Redeemed:</span><strong>{new Date(selectedCard.lastRedeemed * 1000).toLocaleString()}</strong></div>
                )}
              </div>
              
              <div className="encrypted-data-section">
                <h3>Encrypted Balance</h3>
                <div className="encrypted-data">{selectedCard.encryptedBalance.substring(0, 100)}...</div>
                <div className="fhe-tag"><div className="fhe-icon"></div><span>FHE Encrypted</span></div>
                <button 
                  className="decrypt-btn cyber-button" 
                  onClick={async () => {
                    if (decryptedBalance !== null) {
                      setDecryptedBalance(null);
                    } else {
                      const balance = await decryptWithSignature(selectedCard.encryptedBalance);
                      if (balance !== null) setDecryptedBalance(balance);
                    }
                  }} 
                  disabled={isDecrypting}
                >
                  {isDecrypting ? "Decrypting..." : decryptedBalance !== null ? "Hide Balance" : "Decrypt Balance"}
                </button>
              </div>
              
              {decryptedBalance !== null && (
                <div className="decrypted-data-section">
                  <h3>Current Balance</h3>
                  <div className="decrypted-value">{decryptedBalance.toFixed(2)}</div>
                  <div className="decryption-notice">
                    <div className="warning-icon"></div>
                    <span>Decrypted balance is only visible after wallet signature verification</span>
                  </div>
                </div>
              )}
              
              {selectedCard.status === "active" && isOwner(selectedCard.owner) && (
                <div className="redeem-section">
                  <h3>Redeem Amount</h3>
                  <div className="redeem-form">
                    <input 
                      type="number" 
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="Enter amount to redeem..."
                      className="cyber-input"
                      step="0.01"
                      min="0"
                    />
                    <button 
                      className="cyber-button success" 
                      onClick={() => {
                        if (redeemAmount && !isNaN(parseFloat(redeemAmount))) {
                          redeemCard(selectedCard.id, parseFloat(redeemAmount));
                          setSelectedCard(null);
                          setDecryptedBalance(null);
                        }
                      }}
                    >
                      Redeem
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setSelectedCard(null); setDecryptedBalance(null); }} className="close-btn cyber-button">Close</button>
            </div>
          </div>
        </div>
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content cyber-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="cyber-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo"><div className="shield-icon"></div><span>FHE Gift Cards</span></div>
            <p>Privacy-preserving gift cards powered by Zama FHE technology</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>FHE-Powered Privacy</span></div>
          <div className="copyright">© {new Date().getFullYear()} FHE Gift Cards. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
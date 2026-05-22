import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, FileImage, Layers } from 'lucide-react';
import { API_BASE_URL } from '../utils/constants.js';
import toast from 'react-hot-toast';

const B2BVerification = () => {
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [medicineFile, setMedicineFile] = useState(null);
  
  // Manual Fallback
  const [manualGstin, setManualGstin] = useState('');
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [manualBatchNumber, setManualBatchNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleInvoiceChange = (e) => setInvoiceFile(e.target.files[0]);
  const handleMedicineChange = (e) => setMedicineFile(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!invoiceFile && (!manualGstin || !manualInvoiceNumber)) {
      toast.error('Please upload an invoice or provide manual details.');
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    if (invoiceFile) formData.append('invoiceImage', invoiceFile);
    if (medicineFile) formData.append('medicineImage', medicineFile);
    if (manualGstin) formData.append('manualGstin', manualGstin);
    if (manualInvoiceNumber) formData.append('manualInvoiceNumber', manualInvoiceNumber);
    if (manualBatchNumber) formData.append('manualBatchNumber', manualBatchNumber);

    try {
      const response = await axios.post(`${API_BASE_URL}/wholesale/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      setResult(response.data.data);
      toast.success('B2B Verification Complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderScore = (score) => {
    let colorClass = 'text-success';
    if (score < 40) colorClass = 'text-danger';
    else if (score < 80) colorClass = 'text-warning';

    return (
      <div className={`text-6xl font-black ${colorClass} text-center my-4`}>
        {score}<span className="text-2xl text-text-secondary">/100</span>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">B2B Wholesale</span> Verification
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Secure your supply chain. Upload wholesale invoices and medicine batches to instantly cross-check GSTINs, supplier databases, and CDSCO alerts.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Input Section */}
        <div className="bg-bg-secondary p-6 rounded-2xl border border-border-color shadow-sm">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2 mb-6">
            <Layers className="text-primary" /> Supply Chain Inputs
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Invoice Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-text-secondary uppercase tracking-wider">
                1. Upload GST Invoice
              </label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border-color rounded-xl cursor-pointer bg-bg-primary hover:bg-bg-secondary transition-smooth">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileText className="w-8 h-8 text-primary mb-2" />
                  <p className="text-sm text-text-secondary">
                    {invoiceFile ? invoiceFile.name : <><span className="font-semibold text-primary">Click to upload</span> or drag and drop</>}
                  </p>
                </div>
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleInvoiceChange} />
              </label>
            </div>

            {/* Medicine Strip Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-text-secondary uppercase tracking-wider">
                2. Upload Physical Medicine (Optional)
              </label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border-color rounded-xl cursor-pointer bg-bg-primary hover:bg-bg-secondary transition-smooth">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileImage className="w-8 h-8 text-accent mb-2" />
                  <p className="text-sm text-text-secondary">
                    {medicineFile ? medicineFile.name : <><span className="font-semibold text-accent">Click to upload</span> or drag and drop</>}
                  </p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleMedicineChange} />
              </label>
            </div>

            {/* Manual Fallbacks */}
            <div className="pt-4 border-t border-border-color">
              <p className="text-xs text-text-secondary uppercase font-bold tracking-widest mb-4">Manual Entry Fallback (If images are blurry)</p>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" placeholder="GSTIN (e.g. 09ABCDE...)" 
                  value={manualGstin} onChange={(e) => setManualGstin(e.target.value)}
                  className="bg-bg-primary border border-border-color text-text-primary text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
                />
                <input 
                  type="text" placeholder="Invoice No." 
                  value={manualInvoiceNumber} onChange={(e) => setManualInvoiceNumber(e.target.value)}
                  className="bg-bg-primary border border-border-color text-text-primary text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
                />
                <input 
                  type="text" placeholder="Batch Number" 
                  value={manualBatchNumber} onChange={(e) => setManualBatchNumber(e.target.value)}
                  className="col-span-2 bg-bg-primary border border-border-color text-text-primary text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-smooth shadow-lg hover:-translate-y-1 ${
                loading ? 'bg-text-secondary cursor-not-allowed' : 'bg-gradient-to-r from-primary to-accent hover:shadow-primary/25'
              }`}
            >
              {loading ? (
                <span className="animate-pulse">Processing Agent Analysis...</span>
              ) : (
                <>
                  <Shield size={24} /> Generate Trust Report
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Section */}
        <div className="bg-bg-secondary p-6 rounded-2xl border border-border-color shadow-sm flex flex-col h-full min-h-[500px]">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2 mb-6">
            <CheckCircle className="text-success" /> B2B Trust Report
          </h2>

          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary opacity-50">
              <Shield size={64} className="mb-4" />
              <p>Upload documents and click generate to see the trust score.</p>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary mb-4"></div>
              <p className="text-text-primary font-bold animate-pulse">Running Neural Inspection...</p>
            </div>
          )}

          {result && (
            <div className="flex flex-col h-full">
              {/* Score */}
              <div className="bg-bg-primary rounded-xl p-6 border border-border-color mb-6 flex flex-col items-center">
                <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">Confidence Score</p>
                {renderScore(result.score)}
                
                {result.score >= 80 && <span className="px-4 py-1 bg-success/20 text-success rounded-full text-sm font-bold mt-2 flex items-center gap-1"><CheckCircle size={16}/> VERIFIED SAFE</span>}
                {result.score < 80 && result.score >= 40 && <span className="px-4 py-1 bg-warning/20 text-warning rounded-full text-sm font-bold mt-2 flex items-center gap-1"><AlertTriangle size={16}/> SUSPICIOUS</span>}
                {result.score < 40 && <span className="px-4 py-1 bg-danger/20 text-danger rounded-full text-sm font-bold mt-2 flex items-center gap-1"><XCircle size={16}/> HIGH RISK - DO NOT BUY</span>}
              </div>

              {/* Extracted Info */}
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center py-2 border-b border-border-color">
                  <span className="text-text-secondary font-semibold">Extracted GSTIN:</span>
                  <span className="text-text-primary font-mono">{result.gstin || 'NOT FOUND'}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-border-color">
                  <span className="text-text-secondary font-semibold">Supplier Status:</span>
                  {result.supplierDetails ? (
                    <span className="text-success font-bold flex items-center gap-1"><CheckCircle size={14}/> {result.supplierDetails.businessName} (Authorized)</span>
                  ) : (
                    <span className="text-danger font-bold flex items-center gap-1"><AlertTriangle size={14}/> Unverified/Not in DB</span>
                  )}
                </div>

                <div className="py-2 border-b border-border-color">
                  <span className="text-text-secondary font-semibold block mb-2">Invoice Batches Found:</span>
                  <div className="flex flex-wrap gap-2">
                    {result.extractedBatches?.length > 0 ? (
                      result.extractedBatches.map((b, i) => (
                        <span key={i} className="px-2 py-1 bg-bg-primary border border-border-color rounded text-xs font-mono">{b}</span>
                      ))
                    ) : (
                      <span className="text-sm text-text-secondary italic">No batches extracted from invoice</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border-color">
                  <span className="text-text-secondary font-semibold">Physical Batch Scanned:</span>
                  <span className="text-text-primary font-mono bg-bg-primary px-2 rounded border border-border-color">{result.physicalBatch || 'N/A'}</span>
                </div>
              </div>

              {/* Flags */}
              {result.flags?.length > 0 && (
                <div className="mt-6 bg-danger/5 border border-danger/20 rounded-xl p-4">
                  <h3 className="text-danger font-bold flex items-center gap-2 mb-2"><AlertTriangle size={18}/> Red Flags</h3>
                  <ul className="list-disc list-inside text-sm text-text-primary space-y-1">
                    {result.flags.map((flag, idx) => (
                      <li key={idx}>{flag.replace(/_/g, ' ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default B2BVerification;

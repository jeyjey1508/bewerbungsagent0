import { DotPulse } from '@uiball/loaders';
import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [formData, setFormData] = useState({
    personal: {
      vorname: "",
      nachname: "", 
      alter: "",
      email: "",
      telefon: "",
      adresse: ""
    },
    qualifications: {
      position: "",
      ausbildung: "",
      berufserfahrung: "", 
      staerken: "",
      sprachen: "",
      motivation: ""
    },
    company: {
      firmenname: "",
      ansprechpartner: "",
      firmenadresse: ""
    },
    stil: "Formell",
    includeUnterschrift: false,
    gdpr_consent: false
  });

  const [generatedApplication, setGeneratedApplication] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLizenzCheck = async () => {
    try {
      const response = await axios.post(`${API}/verify-key`, { key: lizenzKey });
      if (response.data.valid) {
        localStorage.setItem("verifiedKey", lizenzKey);
        setIsVerified(true);
      } else {
        alert("❌ Ungültiger Lizenzschlüssel");
      }
    } catch (err) {
      alert("Fehler bei der Lizenzprüfung");
    }
  };

  useEffect(() => {
    const savedKey = localStorage.getItem("verifiedKey");
    if (savedKey) {
      axios.post(`${API}/verify-key`, { key: savedKey })
        .then((res) => {
          if (res.data.valid) setIsVerified(true);
        });
    }
  }, []);

  if (!isVerified) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
        <h2 className="text-lg font-semibold mb-4">🔐 Lizenzschlüssel eingeben</h2>
        <input
          type="text"
          placeholder="Lizenzschlüssel"
          value={lizenzKey}
          onChange={(e) => setLizenzKey(e.target.value)}
          className="p-2 border rounded mb-3 w-full max-w-sm"
        />
        <button
          onClick={handleLizenzCheck}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Verifizieren
        </button>
      </div>
    );
  }

  // ⬇️ Danach folgt dein restlicher App-Code



  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailFrom, setEmailFrom] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailStatus, setEmailStatus] = useState("");

  const [lizenzKey, setLizenzKey] = useState(localStorage.getItem("lizenzKey") || "");
  const [isVerified, setIsVerified] = useState(!!lizenzKey);
  
  const handleLizenzCheck = async () => {
    try {
      const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_permalink: "DEIN_PRODUKT_SLUG",
          license_key: lizenzKey
        }),
      });
      const data = await res.json();
  
      if (data.success) {
        localStorage.setItem("lizenzKey", lizenzKey);
        setIsVerified(true);
      } else {
        alert("❌ Ungültiger Lizenzschlüssel");
      }
    } catch (err) {
      alert("Fehler bei der Lizenzprüfung.");
    }
  };


    // Lizenz-Handling (vor dem return)
  const [licenseKey, setLicenseKey] = useState(localStorage.getItem("licenseKey") || "");
  const [licenseValid, setLicenseValid] = useState(false);
  const [checkingLicense, setCheckingLicense] = useState(true);
  
  useEffect(() => {
    if (licenseKey) {
      fetch("/api/verify-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: licenseKey })
      })
        .then(res => res.json())
        .then(data => {
          setLicenseValid(data.valid);
          setCheckingLicense(false);
        })
        .catch(() => {
          setLicenseValid(false);
          setCheckingLicense(false);
        });
    } else {
      setCheckingLicense(false);
    }
  }, [licenseKey]);
  
  function handleLicenseSubmit() {
    localStorage.setItem("licenseKey", licenseKey);
    window.location.reload(); // Seite neu laden, damit Validierung erneut läuft
  }


  // Refs für Layout-Stabilisierung
  const previewContainerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(null);

  // Layout-Stabilisierung beim ersten Render
  useEffect(() => {
    if (previewContainerRef.current && !containerHeight) {
      const height = previewContainerRef.current.offsetHeight;
      setContainerHeight(Math.max(height, 600)); // Mindestens 600px
    }
  }, []);

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    if (!formData.gdpr_consent) {
      setError("Bitte stimmen Sie der DSGVO-Vereinbarung zu.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API}/generate-application`, formData);
      setGeneratedApplication(response.data.bewerbungstext);
    } catch (err) {
      setError("Fehler beim Generieren der Bewerbung: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
  const tempElement = document.createElement("div");

  // Nur den Inhalt zwischen <body>...</body> extrahieren
  const bodyMatch = generatedApplication.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  tempElement.innerHTML = bodyMatch ? bodyMatch[1] : generatedApplication;

  // Entferne evtl. vorhandene <style> oder <script>-Elemente, nur zur Sicherheit
  const stylesAndScripts = tempElement.querySelectorAll("style, script");
  stylesAndScripts.forEach(el => el.remove());

  const text = tempElement.innerText;

  navigator.clipboard.writeText(text)
    .then(() => alert("Bewerbungstext in die Zwischenablage kopiert!"))
    .catch(() => alert("Fehler beim Kopieren des Textes."));
};

  const exportToPDF = async () => {
  const filename = `Bewerbung_${formData.personal.vorname}_${formData.personal.nachname}.pdf`;

  const blob = await axios.post(`${API}/export-pdf-from-html`, {
    html: generatedApplication,
    filename: filename
  }, {
    responseType: 'blob'
  });

  const url = window.URL.createObjectURL(new Blob([blob.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

  const sendAsEmail = async () => {
  if (!emailTo || !emailSubject) {
    setEmailStatus("Bitte alle Felder ausfüllen.");
    return;
  }

  const filename = `Bewerbung_${formData.personal.vorname}_${formData.personal.nachname}.pdf`;

  try {
    await axios.post(`${API}/send-email`, {
      to: emailTo,
      from: emailFrom,
      subject: emailSubject,
      html: generatedApplication,
      filename,
    });

    setEmailStatus("E-Mail erfolgreich gesendet!");
    setTimeout(() => {
      setShowEmailModal(false);
      setEmailFrom("");
      setEmailTo("");
      setEmailSubject("");
      setEmailStatus("");
    }, 2500);
  } catch (err) {
    setEmailStatus("Fehler beim Senden: " + (err.response?.data?.detail || err.message));
  }
};

  return (
  {checkingLicense ? (
  <div className="p-6 text-center">🔄 Lizenz wird geprüft...</div>
) : !licenseValid ? (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">🔐 Lizenz erforderlich</h2>
      <p className="text-sm text-gray-600 mb-4">Bitte gib deinen Lizenzschlüssel ein oder kaufe einen über Gumroad:</p>
      <input
        type="text"
        className="w-full border p-2 rounded mb-3"
        value={licenseKey}
        onChange={(e) => setLicenseKey(e.target.value)}
        placeholder="z. B. GUM-XXXX-XXXX-XXXX"
      />
      <button
        onClick={handleLicenseSubmit}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        Lizenz prüfen
      </button>
      <p className="text-xs text-gray-500 mt-4">
        Noch keinen Lizenzschlüssel? <a href="https://dein-gumroad-link.com" className="text-blue-600 underline">Jetzt kaufen</a>
      </p>
    </div>
  </div>
) : (
  <>
    {/* Dein bisheriger App-Content kommt hier rein */}

    
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2 sm:mb-4">🔧 Bewerbungsgenerator</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 px-2">Erstellen Sie professionelle Bewerbungsschreiben mit KI-Unterstützung</p>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8" style={{ alignItems: 'stretch' }}>
          {/* Form Section */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 order-1 lg:order-1">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">📋 Bewerbungsdaten eingeben</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Personal Data Section */}
              <div className="border-l-4 border-blue-500 pl-3 sm:pl-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-3 sm:mb-4">👤 Persönliche Daten</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Vorname</label>
                    <input
                      type="text"
                      value={formData.personal.vorname}
                      onChange={(e) => handleInputChange('personal', 'vorname', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Nachname</label>
                    <input
                      type="text"
                      value={formData.personal.nachname}
                      onChange={(e) => handleInputChange('personal', 'nachname', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Alter</label>
                    <input
                      type="number"
                      value={formData.personal.alter}
                      onChange={(e) => handleInputChange('personal', 'alter', parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                    <input
                      type="email"
                      value={formData.personal.email}
                      onChange={(e) => handleInputChange('personal', 'email', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Telefonnummer</label>
                    <input
                      type="text"
                      value={formData.personal.telefon}
                      onChange={(e) => handleInputChange('personal', 'telefon', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Adresse</label>
                    <input
                      type="text"
                      value={formData.personal.adresse}
                      onChange={(e) => handleInputChange('personal', 'adresse', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Qualifications Section */}
              <div className="border-l-4 border-green-500 pl-3 sm:pl-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-3 sm:mb-4">🎓 Qualifikationen & Motivation</h3>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Gewünschte Position</label>
                    <input
                      type="text"
                      value={formData.qualifications.position}
                      onChange={(e) => handleInputChange('qualifications', 'position', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Ausbildung</label>
                    <textarea
                      value={formData.qualifications.ausbildung}
                      onChange={(e) => handleInputChange('qualifications', 'ausbildung', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Berufserfahrung</label>
                    <textarea
                      value={formData.qualifications.berufserfahrung}
                      onChange={(e) => handleInputChange('qualifications', 'berufserfahrung', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Stärken & Fähigkeiten</label>
                    <textarea
                      value={formData.qualifications.staerken}
                      onChange={(e) => handleInputChange('qualifications', 'staerken', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sprachkenntnisse</label>
                    <input
                      type="text"
                      value={formData.qualifications.sprachen}
                      onChange={(e) => handleInputChange('qualifications', 'sprachen', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Motivation</label>
                    <textarea
                      value={formData.qualifications.motivation}
                      onChange={(e) => handleInputChange('qualifications', 'motivation', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Style Selection */}
              <div className="border-l-4 border-purple-500 pl-3 sm:pl-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-3 sm:mb-4">🎨 Bewerbungsstil</h3>
                
                <select
                  value={formData.stil}
                  onChange={(e) => setFormData(prev => ({ ...prev, stil: e.target.value }))}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                >
                  <option value="Formell">Formell</option>
                  <option value="Kreativ">Kreativ</option>
                  <option value="Locker">Locker</option>
                </select>
              
                <label className="flex items-center space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.includeUnterschrift}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, includeUnterschrift: e.target.checked }))
                    }
                    className="accent-purple-500"
                  />
                  <span>Platz für Unterschrift lassen</span>
                </label>
              </div>


              {/* Company Data Section */}
              <div className="border-l-4 border-orange-500 pl-3 sm:pl-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-3 sm:mb-4">🏢 Firmendaten</h3>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Firmenname</label>
                    <input
                      type="text"
                      value={formData.company.firmenname}
                      onChange={(e) => handleInputChange('company', 'firmenname', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
                    <input
                      type="text"
                      value={formData.company.ansprechpartner}
                      onChange={(e) => handleInputChange('company', 'ansprechpartner', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Firmenadresse</label>
                    <input
                      type="text"
                      value={formData.company.firmenadresse}
                      onChange={(e) => handleInputChange('company', 'firmenadresse', e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* GDPR Checkbox */}
              <div className="border-l-4 border-red-500 pl-3 sm:pl-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.gdpr_consent}
                    onChange={(e) => setFormData(prev => ({ ...prev, gdpr_consent: e.target.checked }))}
                    className="mr-2 w-5 h-5 accent-red-500"
                  />
                  <label htmlFor="gdpr" className="text-xs sm:text-sm text-gray-700">
                    <strong>DSGVO-Zustimmung (Pflichtfeld):</strong> Ich stimme zu, dass meine Angaben zur Erstellung einer Bewerbung verwendet werden.
                  </label>
                </div>
              </div>


              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 sm:px-6 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm sm:text-base"
              >
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center">
                    <span className="mb-1 text-xs sm:text-sm">Bewerbung wird generiert…</span>
                    <DotPulse size={30} speed={1.3} color="#ffffff" />
                  </div>
                ) : (
                  "🚀 Bewerbung generieren"
                )}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm">
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* Preview Section - MIT LAYOUT-STABILISIERUNG */}
          <div 
            ref={previewContainerRef}
            className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 order-2 lg:order-2 flex flex-col"
            style={{ 
              minHeight: containerHeight || '600px',
              height: 'auto'
            }}
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">📄 Bewerbungsvorschau</h2>
          
            <div 
              id="applicationPreview" 
              className="border border-gray-200 rounded-lg p-3 sm:p-4 lg:p-6 bg-gray-50 flex-1"
              style={{
                minHeight: '400px',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}
            >
              {generatedApplication ? (
                <div className="space-y-3 sm:space-y-4 h-full flex flex-col">
                  <div
                    className="generated-html text-xs sm:text-sm lg:text-base overflow-auto flex-1"
                    style={{ lineHeight: "1.6", marginTop: "1em" }}
                    dangerouslySetInnerHTML={{ __html: generatedApplication }}
                  ></div>
          
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-200 mt-auto">
                    <button
                      onClick={() => setShowEmailModal(true)}
                      className="w-full sm:w-auto bg-green-600 text-white py-2 px-3 sm:px-4 rounded hover:bg-green-700 text-xs sm:text-sm font-medium transition-colors duration-200"
                    >
                      📧 Als E-Mail senden
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="w-full sm:flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 sm:px-4 rounded-lg font-medium transition-colors duration-200 text-xs sm:text-sm"
                    >
                      📄 Als PDF herunterladen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8 sm:py-16 flex flex-col justify-center h-full">
                  <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📝</div>
                  <p className="text-sm sm:text-lg font-medium">Ihre generierte Bewerbung wird hier angezeigt</p>
                  <p className="text-xs sm:text-sm mt-1 sm:mt-2 px-2">Füllen Sie das Formular aus und klicken Sie auf "Bewerbung generieren"</p>
                </div>
              )}
            </div>
          </div>
        </div>
          
        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md max-h-screen overflow-y-auto">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">📧 Bewerbung per E-Mail senden</h2>
        
              <div className="mb-2 text-xs sm:text-sm">
                <strong>Von:</strong> noreply@bewerbungsai.com
              </div>

              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="An (Empfänger)"
                className="mb-2 w-full border p-2 rounded text-sm sm:text-base"
              />
                       
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Betreff"
                className="mb-2 w-full border p-2 rounded text-sm sm:text-base"
              />
                  
              <div className="text-xs sm:text-sm text-yellow-600 mb-2 p-2 bg-yellow-50 rounded"> 
                ⚠️ <strong>Hinweis:</strong> Die Bewerbung wird technisch von <strong>noreply@bewerbungsai.com</strong> versendet.
                Diese Adresse erscheint als Absender. Es wird empfohlen, die E-Mail zunächst an die eigene Adresse zu senden,
                bevor sie an ein Unternehmen weitergeleitet wird.
              </div>
        
              <div className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 p-2 bg-gray-50 rounded">
                📎 <strong>Anhang:</strong> Bewerbung_{formData.personal.vorname}_{formData.personal.nachname}.pdf
              </div>
        
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-4">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="w-full sm:w-auto bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={sendAsEmail}
                  className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Senden
                </button>
              </div>
        
              {emailStatus && (
                <div className="mt-3 text-xs sm:text-sm text-blue-600 p-2 bg-blue-50 rounded">{emailStatus}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

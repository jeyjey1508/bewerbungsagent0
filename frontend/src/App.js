const [showEmailModal, setShowEmailModal] = useState(false);
const [emailTo, setEmailTo] = useState("");
const [emailStatus, setEmailStatus] = useState("");

import React, { useState } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [formData, setFormData] = useState({
    personal: {
      vorname: "Jeremy",
      nachname: "Hayen", 
      alter: 30,
      email: "jeremyhayen2007@yahoo.com",
      telefon: "732874628491249",
      adresse: "Eckenweg 23, 87163 Washington, D.C."
    },
    qualifications: {
      position: "die beste",
      ausbildung: "fertig",
      berufserfahrung: "keine", 
      staerken: "die besten",
      sprachen: "alle sprachen",
      motivation: "Geld"
    },
    company: {
      firmenname: "ZENEX",
      ansprechpartner: "Frau Schmidt",
      firmenadresse: "Moneyweg 99, 46556 München"
    },
    stil: "Formell",
    gdpr_consent: false
  });

  const [generatedApplication, setGeneratedApplication] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
  if (!emailTo) {
    setEmailStatus("Bitte eine gültige E-Mail-Adresse eingeben.");
    return;
  }

  const filename = `Bewerbung_${formData.personal.vorname}_${formData.personal.nachname}.pdf`;
  const subject = `Bewerbung: ${formData.qualifications.position}`;

  try {
    await axios.post(`${API}/send-email`, {
      to: emailTo,
      subject,
      html: generatedApplication,
      filename
    });
    setEmailStatus("✅ E-Mail erfolgreich gesendet.");
  } catch (err) {
    setEmailStatus("❌ Fehler beim Senden der E-Mail.");
  }
};




  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">🔧 Bewerbungsgenerator</h1>
          <p className="text-lg text-gray-600">Erstellen Sie professionelle Bewerbungsschreiben mit KI-Unterstützung</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">📋 Bewerbungsdaten eingeben</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Data Section */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">👤 Persönliche Daten</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
                    <input
                      type="text"
                      value={formData.personal.vorname}
                      onChange={(e) => handleInputChange('personal', 'vorname', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nachname</label>
                    <input
                      type="text"
                      value={formData.personal.nachname}
                      onChange={(e) => handleInputChange('personal', 'nachname', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alter</label>
                    <input
                      type="number"
                      value={formData.personal.alter}
                      onChange={(e) => handleInputChange('personal', 'alter', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                    <input
                      type="email"
                      value={formData.personal.email}
                      onChange={(e) => handleInputChange('personal', 'email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefonnummer</label>
                    <input
                      type="text"
                      value={formData.personal.telefon}
                      onChange={(e) => handleInputChange('personal', 'telefon', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                    <input
                      type="text"
                      value={formData.personal.adresse}
                      onChange={(e) => handleInputChange('personal', 'adresse', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Qualifications Section */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">🎓 Qualifikationen & Motivation</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gewünschte Position</label>
                    <input
                      type="text"
                      value={formData.qualifications.position}
                      onChange={(e) => handleInputChange('qualifications', 'position', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ausbildung</label>
                    <textarea
                      value={formData.qualifications.ausbildung}
                      onChange={(e) => handleInputChange('qualifications', 'ausbildung', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Berufserfahrung</label>
                    <textarea
                      value={formData.qualifications.berufserfahrung}
                      onChange={(e) => handleInputChange('qualifications', 'berufserfahrung', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stärken & Fähigkeiten</label>
                    <textarea
                      value={formData.qualifications.staerken}
                      onChange={(e) => handleInputChange('qualifications', 'staerken', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sprachkenntnisse</label>
                    <input
                      type="text"
                      value={formData.qualifications.sprachen}
                      onChange={(e) => handleInputChange('qualifications', 'sprachen', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivation</label>
                    <textarea
                      value={formData.qualifications.motivation}
                      onChange={(e) => handleInputChange('qualifications', 'motivation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="2"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Style Selection */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">🎨 Bewerbungsstil</h3>
                <select
                  value={formData.stil}
                  onChange={(e) => setFormData(prev => ({...prev, stil: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Formell">Formell</option>
                  <option value="Kreativ">Kreativ</option>
                  <option value="Locker">Locker</option>
                </select>
              </div>

              {/* Company Data Section */}
              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">🏢 Firmendaten</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname</label>
                    <input
                      type="text"
                      value={formData.company.firmenname}
                      onChange={(e) => handleInputChange('company', 'firmenname', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
                    <input
                      type="text"
                      value={formData.company.ansprechpartner}
                      onChange={(e) => handleInputChange('company', 'ansprechpartner', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firmenadresse</label>
                    <input
                      type="text"
                      value={formData.company.firmenadresse}
                      onChange={(e) => handleInputChange('company', 'firmenadresse', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* GDPR Checkbox */}
              <div className="border-l-4 border-red-500 pl-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="gdpr"
                    checked={formData.gdpr_consent}
                    onChange={(e) => setFormData(prev => ({...prev, gdpr_consent: e.target.checked}))}
                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    required
                  />
                  <label htmlFor="gdpr" className="text-sm text-gray-700">
                    <strong>DSGVO-Zustimmung (Pflichtfeld):</strong> Ich stimme zu, dass meine Angaben zur Erstellung einer Bewerbung verwendet werden.
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? "Bewerbung wird generiert..." : "🚀 Bewerbung generieren"}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">📄 Bewerbungsvorschau</h2>
            
            <div id="applicationPreview" className="border border-gray-200 rounded-lg p-6 min-h-96 bg-gray-50">
              {generatedApplication ? (
                <div className="space-y-4">
                 <div
                  className="generated-html"
                  style={{ lineHeight: "1.8", marginTop: "1em" }}
                  dangerouslySetInnerHTML={{ __html: generatedApplication }}
                ></div>


                  
                  <div className="flex gap-3 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setShowEmailModal(true)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200"
                    >
                      📧 Als E-Mail senden
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200"
                    >
                      📄 Als PDF herunterladen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-16">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-lg">Ihre generierte Bewerbung wird hier angezeigt</p>
                  <p className="text-sm mt-2">Füllen Sie das Formular aus und klicken Sie auf "Bewerbung generieren"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

{showEmailModal && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4">📧 Bewerbung versenden</h2>

      <input
        type="email"
        value={emailTo}
        onChange={(e) => setEmailTo(e.target.value)}
        placeholder="Empfänger-E-Mail eingeben"
        className="w-full px-4 py-2 border rounded-lg mb-4"
      />

      {emailStatus && (
        <p className="text-sm mb-2 text-gray-700">{emailStatus}</p>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => setShowEmailModal(false)}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          Abbrechen
        </button>
        <button
          onClick={sendAsEmail}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Senden
        </button>
      </div>
    </div>
  </div>
)}


export default App;

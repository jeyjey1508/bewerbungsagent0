import React, { useState } from "react";
import axios from "axios";
import "./App.css";

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
    gdpr_consent: false
  });

  const [responseData, setResponseData] = useState(null);
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
    setError("");
    setIsLoading(true);

    if (!formData.gdpr_consent) {
      setError("Bitte stimmen Sie der DSGVO-Vereinbarung zu.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API}/generate-application`, formData);
      setResponseData(res.data);
    } catch (err) {
      setError("Fehler beim Generieren: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-6 text-gray-800">
          📄 Bewerbungsgenerator
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow-lg mb-10">
          {/* Deine Formularfelder hier (wie gehabt) */}



  
                    <div className="grid md:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
    <input
      type="text"
      placeholder="Max"
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
      placeholder="Mustermann"
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
      placeholder="30"
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
      placeholder="max@example.com"
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
      placeholder="0151 12345678"
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
      placeholder="Musterstraße 1, 12345 Berlin"
      value={formData.personal.adresse}
      onChange={(e) => handleInputChange('personal', 'adresse', e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      required
    />
  </div>
</div>



  

          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="gdpr"
              checked={formData.gdpr_consent}
              onChange={(e) => setFormData(prev => ({ ...prev, gdpr_consent: e.target.checked }))}
              className="mt-1 h-4 w-4 text-red-600 border-gray-300 rounded"
            />
            <label htmlFor="gdpr" className="text-sm text-gray-700">
              <strong>DSGVO-Zustimmung:</strong> Ich stimme der Verarbeitung meiner Daten zu.
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
          >
            {isLoading ? "Generiere..." : "🚀 Bewerbung generieren"}
          </button>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded mt-2">
              {error}
            </div>
          )}
        </form>

        {/* Vorschau */}
        <div className="bg-white p-6 rounded shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">📎 Vorschau</h2>
          {responseData ? (
            <div className="space-y-4">
              <iframe
                title="PDF Vorschau"
                src={`data:application/pdf;base64,${responseData.bewerbung_pdf_base64}`}
                width="100%"
                height="600px"
                className="border rounded"
              ></iframe>

              <button
                onClick={() => {
                  const w = window.open();
                  w.document.write(
                    `<iframe width='100%' height='100%' src='data:application/pdf;base64,${responseData.bewerbung_pdf_base64}'></iframe>`
                  );
                }}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                📄 In PDF-Viewer öffnen
              </button>
            </div>
          ) : (
            <p className="text-gray-500">Noch keine Bewerbung generiert.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

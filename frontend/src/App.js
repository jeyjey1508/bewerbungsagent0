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
      adresse: "Eckenweg 23, 87163 Washington, D.C.",
    },
    qualifications: {
      position: "die beste",
      ausbildung: "fertig",
      berufserfahrung: "keine",
      staerken: "die besten",
      sprachen: "alle sprachen",
      motivation: "Geld",
    },
    company: {
      firmenname: "ZENEX",
      ansprechpartner: "Frau Schmidt",
      firmenadresse: "Moneyweg 99, 46556 München",
    },
    stil: "Formell",
    gdpr_consent: false,
  });

  const [generatedApplication, setGeneratedApplication] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailStatus, setEmailStatus] = useState("");

  const handleInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
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
    const bodyMatch = generatedApplication.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    tempElement.innerHTML = bodyMatch ? bodyMatch[1] : generatedApplication;
    const stylesAndScripts = tempElement.querySelectorAll("style, script");
    stylesAndScripts.forEach((el) => el.remove());
    const text = tempElement.innerText;

    navigator.clipboard
      .writeText(text)
      .then(() => alert("Bewerbungstext in die Zwischenablage kopiert!"))
      .catch(() => alert("Fehler beim Kopieren des Textes."));
  };
  const exportToPDF = async () => {
    const filename = `Bewerbung_${formData.personal.vorname}_${formData.personal.nachname}.pdf`;

    try {
      const blob = await axios.post(
        `${API}/export-pdf-from-html`,
        {
          html: generatedApplication,
          filename: filename,
        },
        {
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([blob.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Fehler beim PDF-Export: " + (err.response?.data?.detail || err.message));
    }
  };

  const sendAsEmail = async () => {
    if (!emailTo) {
      setEmailStatus("Bitte geben Sie eine Zieladresse ein.");
      return;
    }

    const filename = `Bewerbung_${formData.personal.vorname}_${formData.personal.nachname}.pdf`;
    const subject = `Bewerbung: ${formData.qualifications.position}`;

    try {
      await axios.post(`${API}/send-email`, {
        to: emailTo,
        subject,
        html: generatedApplication,
        filename,
      });

      setEmailStatus("E-Mail erfolgreich gesendet!");
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailTo("");
        setEmailStatus("");
      }, 2000);
    } catch (err) {
      setEmailStatus("Fehler beim Senden der E-Mail: " + (err.response?.data?.detail || err.message));
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">🔧 Bewerbungsgenerator</h1>
          <p className="text-lg text-gray-600">Erstellen Sie professionelle Bewerbungsschreiben mit KI-Unterstützung</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">📋 Bewerbungsdaten eingeben</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Persönliche Daten */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">👤 Persönliche Daten</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
                    <input
                      type="text"
                      value={formData.personal.vorname}
                      onChange={(e) => handleInputChange("personal", "vorname", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nachname</label>
                    <input
                      type="text"
                      value={formData.personal.nachname}
                      onChange={(e) => handleInputChange("personal", "nachname", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alter</label>
                    <input
                      type="number"
                      value={formData.personal.alter}
                      onChange={(e) => handleInputChange("personal", "alter", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                    <input
                      type="email"
                      value={formData.personal.email}
                      onChange={(e) => handleInputChange("personal", "email", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="text"
                      value={formData.personal.telefon}
                      onChange={(e) => handleInputChange("personal", "telefon", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                    <input
                      type="text"
                      value={formData.personal.adresse}
                      onChange={(e) => handleInputChange("personal", "adresse", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Fortsetzung folgt in Teil 4/4 */}
              {/* Qualifikationen */}
              <div className="border-l-4 border-green-500 pl-4 mt-6">
                <h3 className="text-lg font-medium text-gray-700 mb-4">🎓 Qualifikationen</h3>
                <div className="space-y-4">
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="3"
                    placeholder="Ausbildung"
                    value={formData.qualifications.ausbildung}
                    onChange={(e) => handleInputChange("qualifications", "ausbildung", e.target.value)}
                    required
                  />
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="3"
                    placeholder="Berufserfahrung"
                    value={formData.qualifications.berufserfahrung}
                    onChange={(e) => handleInputChange("qualifications", "berufserfahrung", e.target.value)}
                    required
                  />
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="2"
                    placeholder="Stärken"
                    value={formData.qualifications.staerken}
                    onChange={(e) => handleInputChange("qualifications", "staerken", e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Sprachen"
                    value={formData.qualifications.sprachen}
                    onChange={(e) => handleInputChange("qualifications", "sprachen", e.target.value)}
                    required
                  />
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="2"
                    placeholder="Motivation"
                    value={formData.qualifications.motivation}
                    onChange={(e) => handleInputChange("qualifications", "motivation", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Zustimmung */}
              <div className="flex items-center mt-4">
                <input
                  id="gdpr"
                  type="checkbox"
                  checked={formData.gdpr_consent}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      gdpr_consent: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  required
                />
                <label htmlFor="gdpr" className="ml-2 block text-sm text-gray-700">
                  Ich stimme der Verarbeitung meiner Daten zu.
                </label>
              </div>

              <button
                type="submit"
                className="mt-6 w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition"
              >
                🚀 Bewerbung generieren
              </button>
            </form>
          </div>

          {showEmailModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 shadow-lg w-[90%] max-w-md">
                <h3 className="text-lg font-semibold mb-4">E-Mail-Adresse eingeben</h3>
                <input
                  type="email"
                  placeholder="Empfängeradresse"
                  className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
                <div className="flex justify-between">
                  <button
                    onClick={sendAsEmail}
                    className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                  >
                    Senden
                  </button>
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
                  >
                    Abbrechen
                  </button>
                </div>
                {emailStatus && <p className="text-sm text-gray-600 mt-2">{emailStatus}</p>}
              </div>
            </div>
          )}










          {/* Vorschau und Aktionen */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📄 Bewerbungsvorschau</h2>
            <div
              className="border border-gray-300 rounded p-4 min-h-[300px] overflow-auto bg-gray-50"
              dangerouslySetInnerHTML={{ __html: generatedApplication }}
            ></div>

            {generatedApplication && (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                >
                  📧 Als E-Mail senden
                </button>

                <button
                  onClick={exportToPDF}
                  className="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
                >
                  📄 Als PDF herunterladen
                </button>
              </div>
            )}

            {error && <p className="text-red-600 mt-4">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

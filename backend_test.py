
import requests
import json
import sys
from datetime import datetime

class BewerbungsgeneratorTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.text:
                    try:
                        return success, response.json()
                    except:
                        return success, response.text
                return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_welcome_endpoint(self):
        """Test the welcome endpoint"""
        return self.run_test(
            "Welcome Endpoint",
            "GET",
            "api",
            200
        )

    def test_generate_application(self, application_data):
        """Test application generation"""
        return self.run_test(
            "Generate Application",
            "POST",
            "api/generate-application",
            200,
            data=application_data
        )

def main():
    # Get the backend URL from the frontend .env file
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.strip().split('=')[1].strip('"\'')
                break
    
    print(f"Using backend URL: {backend_url}")
    
    # Setup
    tester = BewerbungsgeneratorTester(backend_url)
    
    # Test 1: Welcome endpoint
    success, response = tester.test_welcome_endpoint()
    if not success:
        print("❌ Welcome endpoint test failed, stopping tests")
        return 1
    else:
        print(f"Welcome message: {response}")

    # Test 2: Generate application with sample data
    sample_data = {
        "personal": {
            "vorname": "Jeremy",
            "nachname": "Hayen",
            "alter": 30,
            "email": "jeremyhayen2007@yahoo.com",
            "telefon": "732874628491249",
            "adresse": "Eckenweg 23, 87163 Washington, D.C."
        },
        "qualifications": {
            "position": "die beste",
            "ausbildung": "fertig",
            "berufserfahrung": "keine",
            "staerken": "die besten",
            "sprachen": "alle sprachen",
            "motivation": "Geld"
        },
        "company": {
            "firmenname": "ZENEX",
            "ansprechpartner": "Frau Schmidt",
            "firmenadresse": "Moneyweg 99, 46556 München"
        },
        "stil": "Formell",
        "gdpr_consent": True
    }
    
    success, response = tester.test_generate_application(sample_data)
    if not success:
        print("❌ Generate application test failed")
        return 1
    else:
        print("✅ Application generated successfully")
        if 'bewerbungstext' in response:
            print("\nGenerated application preview (first 200 chars):")
            print(response['bewerbungstext'][:200] + "...")
        else:
            print("⚠️ No application text found in response")

    # Test 3: Test GDPR validation
    sample_data_no_gdpr = sample_data.copy()
    sample_data_no_gdpr["gdpr_consent"] = False
    
    success, response = tester.test_generate_application(sample_data_no_gdpr)
    if success:
        print("❌ GDPR validation test failed - should reject requests without consent")
        return 1
    else:
        print("✅ GDPR validation working correctly - rejected request without consent")

    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())

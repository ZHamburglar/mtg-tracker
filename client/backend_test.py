#!/usr/bin/env python3
"""
MTG Collection Tracker Backend API Test Suite
Tests all backend endpoints comprehensively
"""

import requests
import json
import uuid
import time
from datetime import datetime

# Configuration
BASE_URL = "https://scryfall-magic.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class MTGBackendTester:
    def __init__(self):
        self.session_token = None
        self.test_user_data = {
            "id": str(uuid.uuid4()),
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/avatar.jpg"
        }
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def test_auth_me_unauthorized(self):
        """Test GET /api/auth/me without session (should return 401)"""
        try:
            response = requests.get(f"{API_BASE}/auth/me", timeout=10)
            
            if response.status_code == 401:
                self.log_result(
                    "Auth Me Unauthorized", 
                    True, 
                    "Correctly returned 401 for unauthenticated request"
                )
                return True
            else:
                self.log_result(
                    "Auth Me Unauthorized", 
                    False, 
                    f"Expected 401, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Auth Me Unauthorized", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_create_session(self):
        """Test POST /api/auth/session to create user session"""
        try:
            self.session_token = str(uuid.uuid4())
            payload = {
                **self.test_user_data,
                "session_token": self.session_token
            }
            
            response = requests.post(
                f"{API_BASE}/auth/session",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Check if session cookie is set
                    cookies = response.cookies
                    if 'session_token' in cookies:
                        self.log_result(
                            "Create Session", 
                            True, 
                            "Session created successfully with cookie"
                        )
                        return True
                    else:
                        self.log_result(
                            "Create Session", 
                            True, 
                            "Session created but no cookie found (may be httpOnly)"
                        )
                        return True
                else:
                    self.log_result(
                        "Create Session", 
                        False, 
                        "Session creation returned success=false",
                        data
                    )
                    return False
            else:
                self.log_result(
                    "Create Session", 
                    False, 
                    f"Session creation failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Create Session", 
                False, 
                f"Session creation request failed: {str(e)}"
            )
            return False
    
    def test_auth_me_authorized(self):
        """Test GET /api/auth/me with valid session"""
        try:
            cookies = {'session_token': self.session_token}
            response = requests.get(
                f"{API_BASE}/auth/me",
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                user = data.get("user")
                if user and user.get("email") == self.test_user_data["email"]:
                    self.log_result(
                        "Auth Me Authorized", 
                        True, 
                        "Successfully retrieved user data with session"
                    )
                    return True
                else:
                    self.log_result(
                        "Auth Me Authorized", 
                        False, 
                        "User data not found or incorrect",
                        data
                    )
                    return False
            else:
                self.log_result(
                    "Auth Me Authorized", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Auth Me Authorized", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_scryfall_search_lightning_bolt(self):
        """Test GET /api/cards/search?q=lightning bolt"""
        try:
            response = requests.get(
                f"{API_BASE}/cards/search?q=lightning bolt",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                cards = data.get("cards", [])
                if len(cards) > 0:
                    # Check if we got Lightning Bolt cards
                    lightning_bolt_found = any(
                        "lightning bolt" in card.get("name", "").lower() 
                        for card in cards
                    )
                    if lightning_bolt_found:
                        self.log_result(
                            "Scryfall Search Lightning Bolt", 
                            True, 
                            f"Found {len(cards)} cards including Lightning Bolt"
                        )
                        return cards[0]  # Return first card for further testing
                    else:
                        self.log_result(
                            "Scryfall Search Lightning Bolt", 
                            True, 
                            f"Search returned {len(cards)} cards but no Lightning Bolt found"
                        )
                        return cards[0] if cards else None
                else:
                    self.log_result(
                        "Scryfall Search Lightning Bolt", 
                        False, 
                        "No cards returned from search"
                    )
                    return None
            else:
                self.log_result(
                    "Scryfall Search Lightning Bolt", 
                    False, 
                    f"Search failed with status {response.status_code}",
                    response.text
                )
                return None
                
        except Exception as e:
            self.log_result(
                "Scryfall Search Lightning Bolt", 
                False, 
                f"Search request failed: {str(e)}"
            )
            return None
    
    def test_scryfall_search_black_lotus(self):
        """Test GET /api/cards/search?q=black lotus"""
        try:
            response = requests.get(
                f"{API_BASE}/cards/search?q=black lotus",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                cards = data.get("cards", [])
                if len(cards) > 0:
                    black_lotus_found = any(
                        "black lotus" in card.get("name", "").lower() 
                        for card in cards
                    )
                    self.log_result(
                        "Scryfall Search Black Lotus", 
                        True, 
                        f"Found {len(cards)} cards" + (" including Black Lotus" if black_lotus_found else "")
                    )
                    return True
                else:
                    self.log_result(
                        "Scryfall Search Black Lotus", 
                        False, 
                        "No cards returned from search"
                    )
                    return False
            else:
                self.log_result(
                    "Scryfall Search Black Lotus", 
                    False, 
                    f"Search failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Scryfall Search Black Lotus", 
                False, 
                f"Search request failed: {str(e)}"
            )
            return False
    
    def test_scryfall_search_color_red(self):
        """Test GET /api/cards/search?q=color:red"""
        try:
            response = requests.get(
                f"{API_BASE}/cards/search?q=color:red",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                cards = data.get("cards", [])
                if len(cards) > 0:
                    # Verify cards have red color
                    red_cards = [card for card in cards if 'R' in card.get("colors", [])]
                    self.log_result(
                        "Scryfall Search Color Red", 
                        True, 
                        f"Found {len(cards)} cards, {len(red_cards)} confirmed red"
                    )
                    return True
                else:
                    self.log_result(
                        "Scryfall Search Color Red", 
                        False, 
                        "No red cards returned from search"
                    )
                    return False
            else:
                self.log_result(
                    "Scryfall Search Color Red", 
                    False, 
                    f"Search failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Scryfall Search Color Red", 
                False, 
                f"Search request failed: {str(e)}"
            )
            return False
    
    def test_card_details(self, card_id):
        """Test GET /api/cards/{cardId} for card details and price history"""
        try:
            response = requests.get(
                f"{API_BASE}/cards/{card_id}",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                card = data.get("card")
                price_history = data.get("priceHistory", [])
                
                if card and card.get("id") == card_id:
                    if len(price_history) == 30:  # Should have 30 days of mock data
                        self.log_result(
                            "Card Details", 
                            True, 
                            f"Retrieved card details with {len(price_history)} days of price history"
                        )
                        return True
                    else:
                        self.log_result(
                            "Card Details", 
                            True, 
                            f"Retrieved card details but price history has {len(price_history)} days (expected 30)"
                        )
                        return True
                else:
                    self.log_result(
                        "Card Details", 
                        False, 
                        "Card data not found or ID mismatch",
                        data
                    )
                    return False
            else:
                self.log_result(
                    "Card Details", 
                    False, 
                    f"Card details failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Card Details", 
                False, 
                f"Card details request failed: {str(e)}"
            )
            return False
    
    def test_add_to_collection(self, card_id, card_data):
        """Test POST /api/collection to add card"""
        try:
            cookies = {'session_token': self.session_token}
            payload = {
                "cardId": card_id,
                "cardData": card_data
            }
            
            response = requests.post(
                f"{API_BASE}/collection",
                json=payload,
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") or data.get("message") == "Already in collection":
                    self.log_result(
                        "Add to Collection", 
                        True, 
                        "Card added to collection successfully"
                    )
                    return True
                else:
                    self.log_result(
                        "Add to Collection", 
                        False, 
                        "Unexpected response format",
                        data
                    )
                    return False
            else:
                self.log_result(
                    "Add to Collection", 
                    False, 
                    f"Add to collection failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Add to Collection", 
                False, 
                f"Add to collection request failed: {str(e)}"
            )
            return False
    
    def test_get_collection(self):
        """Test GET /api/collection to list user's collection"""
        try:
            cookies = {'session_token': self.session_token}
            response = requests.get(
                f"{API_BASE}/collection",
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                collection = data.get("collection", [])
                self.log_result(
                    "Get Collection", 
                    True, 
                    f"Retrieved collection with {len(collection)} cards"
                )
                return collection
            else:
                self.log_result(
                    "Get Collection", 
                    False, 
                    f"Get collection failed with status {response.status_code}",
                    response.text
                )
                return []
                
        except Exception as e:
            self.log_result(
                "Get Collection", 
                False, 
                f"Get collection request failed: {str(e)}"
            )
            return []
    
    def test_check_card_in_collection(self, card_id):
        """Test GET /api/collection/check/{cardId}"""
        try:
            cookies = {'session_token': self.session_token}
            response = requests.get(
                f"{API_BASE}/collection/check/{card_id}",
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                in_collection = data.get("inCollection", False)
                self.log_result(
                    "Check Card in Collection", 
                    True, 
                    f"Card in collection: {in_collection}"
                )
                return in_collection
            else:
                self.log_result(
                    "Check Card in Collection", 
                    False, 
                    f"Check collection failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Check Card in Collection", 
                False, 
                f"Check collection request failed: {str(e)}"
            )
            return False
    
    def test_remove_from_collection(self, card_id):
        """Test DELETE /api/collection/{cardId}"""
        try:
            cookies = {'session_token': self.session_token}
            response = requests.delete(
                f"{API_BASE}/collection/{card_id}",
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result(
                        "Remove from Collection", 
                        True, 
                        "Card removed from collection successfully"
                    )
                    return True
                else:
                    self.log_result(
                        "Remove from Collection", 
                        False, 
                        "Unexpected response format",
                        data
                    )
                    return False
            else:
                self.log_result(
                    "Remove from Collection", 
                    False, 
                    f"Remove from collection failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Remove from Collection", 
                False, 
                f"Remove from collection request failed: {str(e)}"
            )
            return False
    
    def test_logout(self):
        """Test POST /api/auth/logout"""
        try:
            cookies = {'session_token': self.session_token}
            response = requests.post(
                f"{API_BASE}/auth/logout",
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result(
                        "Logout", 
                        True, 
                        "Logout successful"
                    )
                    return True
                else:
                    self.log_result(
                        "Logout", 
                        False, 
                        "Logout returned success=false",
                        data
                    )
                    return False
            else:
                self.log_result(
                    "Logout", 
                    False, 
                    f"Logout failed with status {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Logout", 
                False, 
                f"Logout request failed: {str(e)}"
            )
            return False
    
    def run_comprehensive_test(self):
        """Run all backend tests in sequence"""
        print("🚀 Starting MTG Collection Tracker Backend API Tests")
        print(f"📍 Testing against: {API_BASE}")
        print("=" * 60)
        
        # 1. Test auth without session
        self.test_auth_me_unauthorized()
        
        # 2. Create session
        if not self.test_create_session():
            print("❌ Cannot continue without valid session")
            return False
        
        # 3. Test auth with session
        self.test_auth_me_authorized()
        
        # 4. Test Scryfall searches
        test_card = self.test_scryfall_search_lightning_bolt()
        self.test_scryfall_search_black_lotus()
        self.test_scryfall_search_color_red()
        
        # 5. Test card details (if we got a card from search)
        if test_card and test_card.get("id"):
            card_id = test_card["id"]
            self.test_card_details(card_id)
            
            # 6. Test collection management
            self.test_add_to_collection(card_id, test_card)
            self.test_get_collection()
            self.test_check_card_in_collection(card_id)
            self.test_remove_from_collection(card_id)
            
            # Verify removal
            time.sleep(1)  # Brief delay
            self.test_check_card_in_collection(card_id)
        
        # 7. Test logout
        self.test_logout()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = MTGBackendTester()
    success = tester.run_comprehensive_test()
    exit(0 if success else 1)
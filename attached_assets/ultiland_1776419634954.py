import requests
import time
import json
import random
from eth_account import Account
from eth_account.messages import encode_defunct
from datetime import datetime

# ==========================================
# CONFIGURATION
# ==========================================
PROXY_FILE = "proxies.txt" # "proxies.txt" jika ingin pakai proxy, None jika tanpa proxy

# Headers standard untuk Dapp Ultiland
HEADERS = {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    "origin": "https://dapp.ultiland.io",
    "referer": "https://dapp.ultiland.io/task",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def generate_wallet():
    Account.enable_unaudited_hdwallet_features()
    acct, mnemonic = Account.create_with_mnemonic()
    return acct, mnemonic

def get_session(proxy=None):
    session = requests.Session()
    session.headers.update(HEADERS)
    
    # Injeksi IP Forwarding (Spoofing)
    rand_ip = f"{random.randint(10, 250)}.{random.randint(10, 250)}.{random.randint(10, 250)}.{random.randint(10, 250)}"
    session.headers.update({
        "X-Forwarded-For": rand_ip,
        "X-Real-IP": rand_ip
    })
    
    if proxy:
        session.proxies = {"http": f"http://{proxy}", "https": f"http://{proxy}"}
    return session

def sign_message(acct, text):
    msg = encode_defunct(text=text)
    sig = acct.sign_message(msg)
    hex_sig = sig.signature.hex()
    if not hex_sig.startswith("0x"):
        hex_sig = "0x" + hex_sig
    return hex_sig

def login(session, address, ref_code):
    url = "https://dapp.ultiland.io/apiv2/user/addWalletAddress"
    payload = {"address": address}
    
    try:
        r = session.post(url, json=payload, timeout=15)
        print(f"[*] Login Wallet: {r.status_code}")
        
        # Eksekusi binding referral yang sebenarnya
        if ref_code and ref_code != "USER_REFERRAL_CODE":
            ref_url = "https://dapp.ultiland.io/apiv1/referral/setReferralCode"
            ref_payload = {"invitee": address, "referralCode": ref_code}
            ref_r = session.post(ref_url, json=ref_payload, timeout=15)
            # Jika berhasil, maka responsenya {"message": "Referral relationship created successfully"}
            print(f"[*] Bind Referral: {ref_r.json().get('message', ref_r.text)}")
            
        return r.json()
    except Exception as e:
        print(f"[!] Login error: {e}")
        return None

def check_in(session, acct):
    url = "https://dapp.ultiland.io/apiv2/task/setCheckInList"
    address = acct.address
    date_str = datetime.now().strftime("%Y%m%d")
    message = f"{address.lower()}-{date_str}"
    
    sig = sign_message(acct, message)
    payload = {
        "address": address.lower(),
        "message": message,
        "signature": sig
    }
    
    try:
        r = session.post(url, json=payload, timeout=15)
        print(f"[*] Check In: {r.json()}")
        return r.json()
    except Exception as e:
        print(f"[!] Check in error: {e}")
        return None

def submit_task(session, acct):
    url = "https://dapp.ultiland.io/apiv2/task/answerQuestions"
    address = acct.address.lower()
    # Jawaban: B, B, A -> index [1, 1, 0]
    answers = [1, 1, 0]
    
    # Format message dari frontend: address-110
    answers_str = "".join(map(str, answers))
    msg_to_sign = f"{address}-{answers_str}"
    
    sig = sign_message(acct, msg_to_sign) 
    
    payload = {
        "address": address,
        "answer": answers,
        "signature": sig
    }
    
    try:
        r = session.post(url, json=payload, timeout=15)
        print(f"[*] Submit Task (B,B,A): {r.json()}")
        return r.json()
    except Exception as e:
        print(f"[!] Submit task error: {e}")
        return None

def main():
    print("====================================")
    print("ULTILAND AUTO REFF & DAILY TASK BOT")
    print("====================================")
    
    ref_code_input = input("Masukkan Kode Referral: ").strip()
    try:
        total_reff_input = int(input("Jumlah Akun Yang Ingin Dibuat: ").strip())
    except ValueError:
        print("[!] Jumlah tidak valid, menggunakan default 1.")
        total_reff_input = 1
    
    proxies = []
    if PROXY_FILE:
        try:
            with open(PROXY_FILE, 'r') as f:
                proxies = [x.strip() for x in f.readlines() if x.strip()]
            print(f"[+] Loaded {len(proxies)} proxies.")
        except:
            print("[!] Proxy file not found, running without proxy.")
            
    with open("results.txt", "a") as f:
        pass
        
    for i in range(total_reff_input):
        print(f"\n--- [Account {i+1}/{total_reff_input}] ---")
        acct, mnemonic = generate_wallet()
        print(f"[+] Generated Wallet: {acct.address}")
        print(f"[+] PK: {acct.key.hex()}")
        
        prx = random.choice(proxies) if proxies else None
        session = get_session(prx)
        
        login(session, acct.address, ref_code_input)
        time.sleep(2)
        
        check_in(session, acct)
        time.sleep(2)
        
        submit_task(session, acct)
        time.sleep(2)
        
        # Save account
        with open("results.txt", "a") as f:
            f.write(f"{acct.address}|{acct.key.hex()}|{mnemonic}\n")
            
        print("[+] Success, waiting 5 seconds for next referral...")
        time.sleep(5)
        
if __name__ == "__main__":
    main()

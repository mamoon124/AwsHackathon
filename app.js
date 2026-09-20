// Import Firebase SDK modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// TODO: Replace with your actual Firebase project configuration from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDCjNBws8KUEmQUJSciqb4SEUUbs5zVYCM",
  authDomain: "smart-inventory-manager-5846a.firebaseapp.com",
  projectId: "smart-inventory-manager-5846a",
  storageBucket: "smart-inventory-manager-5846a.firebasestorage.app",
  messagingSenderId: "503651277052",
  appId: "1:503651277052:web:d7cdef0c71a3b7db4bdf79"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// TODO: Paste your API Gateway Endpoint URL here
const API_URL = "https://krw9ctv05g.execute-api.ap-south-1.amazonaws.com/inventory";
let currentInventory = [];

// --- FIREBASE AUTHENTICATION LISTENER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in -> Hide login, show dashboard
        document.getElementById("authContainer").style.display = "none";
        document.getElementById("dashboardContainer").style.display = "block";
        document.getElementById("userEmailDisplay").innerText = `👤 ${user.email}`;
        window.fetchInventory();
    } else {
        // User is signed out -> Show login, hide dashboard
        document.getElementById("authContainer").style.display = "flex";
        document.getElementById("dashboardContainer").style.display = "none";
    }
});

// --- AUTHENTICATION ACTIONS (Attached to window for HTML onclick access) ---
window.handleLogin = async function() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value.trim();
    const msg = document.getElementById("authMsg");
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        msg.style.color = "red";
        msg.innerText = `${error.code}: ${error.message}`;
    }
};

window.handleSignup = async function() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value.trim();
    const msg = document.getElementById("authMsg");
    
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Shop registered successfully!");
    } catch (error) {
        msg.style.color = "red";
        msg.innerText = `${error.code}: ${error.message}`;
        console.error("Firebase Auth Error:", error);
    }
};

window.handleLogout = async function() {
    await signOut(auth);
};

// --- APP LOGIC & AMAZON BEDROCK AI INSIGHTS ---
async function generateInsights() {
    const insightsList = document.getElementById("insightsList");
    insightsList.innerHTML = "<li style='color: #2563eb;'>🤖 Amazon Bedrock is analyzing your inventory...</li>";
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "generate_insights" })
        });
        
        const data = await response.json();
        
        // IF AWS RETURNED A 500 ERROR, SHOW IT ON SCREEN:
        if (data.error) {
            insightsList.innerHTML = `<li style='color: red;'>AWS Error: ${data.error}</li>`;
            return;
        }
        
        if (data.insights) {
            const lines = data.insights.split('\n').filter(line => line.trim() !== '');
            insightsList.innerHTML = lines.map(line => `<li>${line.replace(/^[-*•]\s*/, '')}</li>`).join('');
        } else {
            insightsList.innerHTML = "<li style='color: red;'>Unable to retrieve Bedrock insights.</li>";
        }
    } catch (error) {
        insightsList.innerHTML = `<li style='color: red;'>JavaScript Error: ${error.message}</li>`;
    }
}

// --- FETCH INVENTORY & POPULATE DROPDOWNS ---
window.fetchInventory = async function() {
    const tbody = document.getElementById("inventoryBody");
    const datalist = document.getElementById("medSuggestions");
    const idList = document.getElementById("idSuggestions");
    const nameList = document.getElementById("nameSuggestions");
    
    tbody.innerHTML = "<tr><td colspan='6'>Fetching data from AWS...</td></tr>";
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        currentInventory = data; 
        
        // Trigger Amazon Bedrock AI analysis
        generateInsights();

        tbody.innerHTML = "";
        datalist.innerHTML = "";
        idList.innerHTML = ""; 
        nameList.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6'>No items found. Add some below!</td></tr>";
            return;
        }

        const uniqueNames = new Set();
        data.forEach(item => {
            const row = document.createElement("tr");
            if (item.quantity < 10) row.classList.add("low-stock");
            row.innerHTML = `
                <td><strong>${item.medicine_id}</strong></td>
                <td>${item.medicine_name}</td>
                <td>${item.quantity} ${item.quantity < 10 ? '⚠️' : ''}</td>
                <td>${item.expiry_date}</td>
                <td>${item.rack_location}</td>
                <td>₹${item.unit_price}</td>
            `;
            tbody.appendChild(row);

            const option = document.createElement("option");
            option.value = `${item.medicine_id} - ${item.medicine_name}`;
            datalist.appendChild(option);

            const idOption = document.createElement("option");
            idOption.value = item.medicine_id;
            idList.appendChild(idOption);
            
            uniqueNames.add(item.medicine_name);
        });

        uniqueNames.forEach(name => {
            const nameOption = document.createElement("option");
            nameOption.value = name;
            nameList.appendChild(nameOption);
        });

    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='6' style='color:red;'>Error fetching data.</td></tr>";
    }
};

// --- MODIFY STOCK (POST) ---
window.modifyStock = async function(multiplier) {
    const searchInput = document.getElementById("searchMed").value;
    const medId = searchInput.split(" - ")[0].trim();
    const rawQty = document.getElementById("qtyChange").value;
    const parsedQty = parseInt(rawQty);
    const msg = document.getElementById("updateMsg");

    if (!medId || !rawQty || parsedQty <= 0) return alert("Select a medicine and enter a valid quantity!");

    const existingMedicine = currentInventory.find(m => m.medicine_id === medId);
    if (existingMedicine && multiplier === -1 && parsedQty > existingMedicine.quantity) {
        return alert(`⚠️ Cannot sell ${parsedQty}. Only ${existingMedicine.quantity} left!`);
    }

    msg.style.color = "blue";
    msg.innerText = "Updating AWS DynamoDB...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ medicine_id: medId, quantity: parsedQty * multiplier })
        });
        const result = await response.json();
        
        if(response.ok) {
            msg.style.color = "green";
            msg.innerText = result.message;
            document.getElementById("searchMed").value = "";
            document.getElementById("qtyChange").value = "";
            window.fetchInventory();
        } else throw new Error();
    } catch (error) {
        msg.style.color = "red"; msg.innerText = "Error updating stock.";
    }
};

// --- ADD NEW MEDICINE (PUT) ---
window.addNewMedicine = async function() {
    const medId = document.getElementById("newId").value.trim().toUpperCase();
    const name = document.getElementById("newName").value;
    const qty = document.getElementById("newQty").value;
    const expiry = document.getElementById("newExpiry").value;
    const rack = document.getElementById("newRack").value;
    const price = document.getElementById("newPrice").value;
    const msg = document.getElementById("createMsg");

    if (!medId || !name) return alert("ID and Name are required!");

    const doesIdExist = currentInventory.find(m => m.medicine_id === medId);
    if (doesIdExist) return alert(`⚠️ ID '${medId}' already exists!`);

    msg.style.color = "blue";
    msg.innerText = "Saving to AWS...";

    try {
        const response = await fetch(API_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                medicine_id: medId,
                medicine_name: name,
                quantity: parseInt(qty) || 0,
                expiry_date: expiry || 'N/A',
                rack_location: rack || 'N/A',
                unit_price: parseFloat(price) || 0.0
            })
        });
        
        const result = await response.json();
        if(response.ok) {
            msg.style.color = "green";
            msg.innerText = result.message;
            document.querySelectorAll('#newId, #newName, #newQty, #newExpiry, #newRack, #newPrice').forEach(i => i.value = '');
            window.fetchInventory();
        } else throw new Error();
    } catch (error) {
        msg.style.color = "red"; msg.innerText = "Error creating medicine.";
    }
};
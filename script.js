// --- 1. SECURITY ---
if (sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = "login.html"; }
function logout() { sessionStorage.removeItem('isLoggedIn'); window.location.href = "login.html"; }

// --- 2. DATA & THRESHOLDS ---
// Expanded thresholds to cover all items in your HTML dropdown
const THRESHOLDS = { 
    'Oxygen Tanks': 5, 
    'Malaria Kits': 50, 
    'Antibiotics': 20,
    'IV Fluids': 15,
    'Clean Delivery Kits': 15,
    'Oxytocin Ampoules': 10,
    'Malaria RDT Kits': 100,
    'HIV Test Strips': 30,
    'BCG Vaccine (TB)': 20,
    'Polio (nOPV2)': 50,
    'Measles (MR) Vaccine': 25,
    'Cold Box Ice Packs': 12,
    'IV Saline Bags (500ml)': 30,
    'Amoxicillin (Kids)': 25
};

let db = JSON.parse(localStorage.getItem('gargaar_db')) || [];
let invChart, statChart, map;

// --- 3. CORE LOGIC ---
function initMap() {
    try {
        map = L.map('map').setView([9.56, 44.06], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        refreshUI();
    } catch (e) { console.error("Map failed to load", e); }
}

function addItem() {
    const v = document.getElementById('village').value;
    const q = parseInt(document.getElementById('qty').value);
    const i = document.getElementById('item').value;
    const lat = parseFloat(document.getElementById('lat').value) || (9.5 + Math.random()*0.5);
    const lng = parseFloat(document.getElementById('lng').value) || (44.0 + Math.random()*0.5);

    if(!v || isNaN(q)) return alert("Please fill all fields!");

    // Use the specific threshold for the item, default to 10 if not listed
    const minRequired = THRESHOLDS[i] || 10;
    const status = q < minRequired ? "Critical" : "Stable";
    
    if(status === "Critical") { 
        const alertSound = document.getElementById('alertSound');
        if(alertSound) alertSound.play(); 
    }

    db.push({ village: v, item: i, qty: q, status: status, lat: lat, lng: lng });
    localStorage.setItem('gargaar_db', JSON.stringify(db));
    refreshUI();
    
    // Clear inputs
    document.getElementById('village').value = '';
    document.getElementById('qty').value = '';
}

function refreshUI() {
    renderTable();
    updateStats();
    updateCharts();
    updateMap();
    generateAdvice();
}

function updateStats() {
    const crit = db.filter(e => e.status === 'Critical').length;
    document.getElementById('stat-total').innerText = db.length;
    document.getElementById('stat-critical').innerText = crit;
    document.getElementById('stat-stable').innerText = db.length - crit;
    
    // --- COVERAGE LOGIC ---
    // We assume a target goal of 10 unique villages for the demo
    const targetVillages = 10;
    const uniqueVillages = [...new Set(db.map(e => e.village.toLowerCase()))].length;
    let coverage = Math.round((uniqueVillages / targetVillages) * 100);
    if(coverage > 100) coverage = 100;
    document.getElementById('stat-coverage').innerText = coverage + "%";
}

// --- WHATSAPP EMERGENCY BRIDGE ---
function sendWhatsApp() {
    if (db.length === 0) return alert("No data available.");

    // Sort to find the most critical (lowest qty)
    const emergencySite = [...db].sort((a, b) => a.qty - b.qty)[0];

    if (emergencySite.status !== "Critical") {
        return alert("Status: No critical shortages detected currently.");
    }

    const phone = "25263XXXXXXX"; // Regional Coordinator
    const msg = `*Gargaar-Link EMERGENCY ALERT*%0A` +
                `--------------------------%0A` +
                `*Location:* ${emergencySite.village}%0A` +
                `*Item:* ${emergencySite.item}%0A` +
                `*Qty:* ${emergencySite.qty}%0A` +
                `*Status:* CRITICAL%0A` +
                `--------------------------%0A` +
                `_Sent via National Supply Command Center_`;

    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

function updateMap() {
    if(!map) return;
    map.eachLayer(l => { if(l instanceof L.Marker) map.removeLayer(l); });
    db.forEach(e => {
        const markerColor = e.status === 'Critical' ? 'red' : 'green';
        L.marker([e.lat, e.lng]).addTo(map).bindPopup(`<b>${e.village}</b><br>${e.item}: ${e.qty}<br>Status: ${e.status}`);
    });
}

function updateCharts() {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#fff' : '#333';
    
    const ctx1 = document.getElementById('statusDoughnut').getContext('2d');
    if(statChart) statChart.destroy();
    statChart = new Chart(ctx1, {
        type: 'doughnut',
        data: { labels: ['Critical', 'Stable'], datasets: [{ data: [db.filter(e => e.status === 'Critical').length, db.filter(e => e.status === 'Stable').length], backgroundColor: ['#d21034', '#006a4e'] }] },
        options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } } }
    });

    const ctx2 = document.getElementById('inventoryChart').getContext('2d');
    if(invChart) invChart.destroy();
    invChart = new Chart(ctx2, {
        type: 'bar',
        data: { labels: db.map(e => e.village), datasets: [{ label: 'Stock Level', data: db.map(e => e.qty), backgroundColor: '#006a4e' }] },
        options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } }
    });
}

function generateAdvice() {
    const panel = document.getElementById('redistribution-panel');
    const container = document.getElementById('transfer-advice');
    let advice = [];
    
    const criticals = db.filter(e => e.status === 'Critical');
    const surpluses = db.filter(e => e.qty > (THRESHOLDS[e.item] * 2));

    criticals.forEach(c => {
        const donor = surpluses.find(s => s.item === c.item);
        if(donor) advice.push(`<p>💡 Transfer <strong>${Math.floor(donor.qty/4)} units</strong> from ${donor.village} to ${c.village}</p>`);
    });

    panel.style.display = advice.length > 0 ? 'block' : 'none';
    container.innerHTML = advice.join('');
}

function renderTable() {
    const term = document.getElementById('search').value.toLowerCase();
    document.getElementById('tableBody').innerHTML = db.filter(e => e.village.toLowerCase().includes(term)).map(e => `
        <tr><td>${e.village}</td><td>${e.item}</td><td>${e.qty}</td>
        <td style="color:${e.status==='Critical'?'#d21034':'#006a4e'}"><strong>${e.status}</strong></td></tr>
    `).join('');
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    refreshUI();
}

function downloadCSV() {
    let csv = "Village,Item,Qty,Status\n" + db.map(e => `${e.village},${e.item},${e.qty},${e.status}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Gargaar_Report.csv'; a.click();
}

function clearData() { if(confirm("Clear database?")) { db = []; localStorage.removeItem('gargaar_db'); refreshUI(); } }

window.onload = initMap;
const loginDiv = document.getElementById('login');
const mainDiv = document.getElementById('main');
const usernameSpan = document.getElementById('username');
const balanceSpan = document.getElementById('balance-amount');
const loginForm = document.getElementById('login-form');
const signupBtn = document.getElementById('signup-btn');
const reserveModal = new bootstrap.Modal(document.getElementById('reserveModal'));
const hoursInput = document.getElementById('hours-input');
const hourlyPriceSpan = document.getElementById('hourly-price');
const totalPriceSpan = document.getElementById('total-price');
const streetNameP = document.getElementById('street-name');
const confirmPayBtn = document.getElementById('confirm-pay-btn');
const modalAlert = document.getElementById('modal-alert');
const alertContainer = document.getElementById('alert-container');

let currentStreetData = null;
let currentHourlyPrice = 0;

// Handle signup mock
signupBtn.addEventListener('click', () => {
    alert('Sign up not implemented in this demo.');
});

// Check if logged in
if (localStorage.getItem('username')) {
    loginDiv.style.display = 'none';
    mainDiv.style.display = 'block';
    usernameSpan.textContent = localStorage.getItem('username');
    if (!localStorage.getItem('balance')) {
        localStorage.setItem('balance', '10.00');
    }
    balanceSpan.textContent = localStorage.getItem('balance');
    initMap();
}

// Handle login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username-input').value;
    if (username) {
        localStorage.setItem('username', username);
        localStorage.setItem('balance', '10.00');
        location.reload(); // Reload to show map
    }
});

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

function initMap() {
    const map = L.map('map').setView([45.5231, -122.6765], 13); // Center on Portland downtown

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    // Geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatLng = [position.coords.latitude, position.coords.longitude];
                L.marker(userLatLng, {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(map).bindPopup('You are here').openPopup();
                map.setView(userLatLng, 15);
            },
            (error) => {
                console.error('Geolocation error:', error);
            }
        );
    }

    const markersLayer = L.layerGroup().addTo(map); // Group for markers

    // Fetch streets from Overpass API (approximating the ZIP areas with a bound covering them)
    const bbox = '45.48,-122.71,45.54,-122.65'; // Combined bound for the ZIPs
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(way["highway"~"residential|secondary|tertiary"](${bbox}););out center;`;

    fetch(overpassUrl)
        .then(response => response.json())
        .then(data => {
            const streets = data.elements.filter(el => el.type === 'way' && el.center);
            const streetData = {}; // To store per-street data

            streets.forEach((street, index) => {
                let name = street.tags.name || `Street ${index + 1}`;
                let key = name; // Use name as base key
                let counter = 1;
                while (streetData[key]) { // If duplicate name, append unique suffix
                    key = `${name} (${counter})`;
                    counter++;
                }
                const totalSpots = Math.floor(Math.random() * 6) + 5; // 5-10 static
                let available = Math.floor(Math.random() * (totalSpots + 1)); // Initial random 0-total
                streetData[key] = { total: totalSpots, available, lat: street.center.lat, lon: street.center.lon, displayName: name };

                const marker = L.circleMarker([street.center.lat, street.center.lon], {
                    color: '#6c3bf2',
                    fillColor: '#feffc5',
                    fillOpacity: 0.8,
                    radius: 8
                });

                marker.on('click', () => {
                    const occupied = streetData[key].total - streetData[key].available;
                    const hourlyPrice = (1 + Math.random() * 4).toFixed(2);
                    const popupContent = `
                        <b>${streetData[key].displayName}</b><br>
                        Available: ${streetData[key].available}<br>
                        Occupied: ${occupied}<br>
                        Total: ${streetData[key].total}<br>
                        Price: $${hourlyPrice} / hour<br>
                        <button class="btn btn-sm btn-primary mt-2" id="reserve-btn-${index}" style="background-color: #6c3bf2; border-color: #6c3bf2;">Reserve Spot</button>
                    `;
                    marker.bindPopup(popupContent).openPopup();

                    setTimeout(() => {
                        const reserveBtn = document.getElementById(`reserve-btn-${index}`);
                        if (reserveBtn) {
                            reserveBtn.addEventListener('click', () => {
                                if (streetData[key].available > 0) {
                                    currentStreetData = streetData[key];
                                    currentStreetData.name = streetData[key].displayName;
                                    currentHourlyPrice = parseFloat(hourlyPrice);
                                    streetNameP.textContent = `Street: ${streetData[key].displayName}`;
                                    hourlyPriceSpan.textContent = currentHourlyPrice.toFixed(2);
                                    totalPriceSpan.textContent = currentHourlyPrice.toFixed(2);
                                    hoursInput.value = 1;
                                    modalAlert.classList.add('d-none');
                                    reserveModal.show();
                                    marker.closePopup();
                                } else {
                                    showAlert('No available spots!', 'danger');
                                }
                            });
                        }
                    }, 100);
                });

                streetData[key].marker = marker;
            });

            // Add markers to layer
            Object.values(streetData).forEach(sd => markersLayer.addLayer(sd.marker));

            // Zoom listener
            map.on('zoomend', () => {
                const zoom = map.getZoom();
                if (zoom >= 15) {
                    if (!map.hasLayer(markersLayer)) {
                        map.addLayer(markersLayer);
                    }
                } else {
                    if (map.hasLayer(markersLayer)) {
                        map.removeLayer(markersLayer);
                    }
                }
            });

            // Initial check
            if (map.getZoom() < 15) {
                map.removeLayer(markersLayer);
            }

            // Dynamic updates every 10-15s
            setInterval(() => {
                Object.keys(streetData).forEach(key => {
                    const change = Math.random() < 0.5 ? -1 : 1;
                    streetData[key].available = Math.max(0, Math.min(streetData[key].total, streetData[key].available + change));
                });
                // Note: Popups won't auto-update; user needs to re-click
            }, Math.floor(Math.random() * 5000) + 10000); // 10-15s random
        })
        .catch(error => console.error('Overpass error:', error));
}

// Handle hours input change
hoursInput.addEventListener('input', () => {
    let hours = parseInt(hoursInput.value) || 1;
    if (hours > 4) {
        hours = 4;
        hoursInput.value = 4;
    }
    const total = (hours * currentHourlyPrice).toFixed(2);
    totalPriceSpan.textContent = total;
    const balance = parseFloat(localStorage.getItem('balance'));
    if (balance >= parseFloat(total)) {
        modalAlert.classList.add('d-none');
    } else {
        modalAlert.textContent = 'Insufficient balance!';
        modalAlert.classList.remove('d-none');
    }
});

// Handle confirm pay
confirmPayBtn.addEventListener('click', () => {
    let hours = parseInt(hoursInput.value) || 1;
    if (hours > 4) {
        hours = 4;
        hoursInput.value = 4;
    }
    const totalPrice = hours * currentHourlyPrice;
    let balance = parseFloat(localStorage.getItem('balance'));
    if (balance >= totalPrice) {
        balance -= totalPrice;
        localStorage.setItem('balance', balance.toFixed(2));
        balanceSpan.textContent = balance.toFixed(2);
        currentStreetData.available--;
        reserveModal.hide();
        showAlert('Reservation successful! Spot reserved for ' + hours + ' hours.', 'success');
    } else {
        modalAlert.textContent = 'Insufficient balance!';
        modalAlert.classList.remove('d-none');
    }
});
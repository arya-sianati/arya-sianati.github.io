const loginDiv = document.getElementById('login');
const mainDiv = document.getElementById('main');
const usernameSpan = document.getElementById('username');
const creditsSpan = document.getElementById('credits-amount');
const loginForm = document.getElementById('login-form');

// Check if logged in
if (localStorage.getItem('username')) {
    loginDiv.style.display = 'none';
    mainDiv.style.display = 'block';
    usernameSpan.textContent = localStorage.getItem('username');
    if (!localStorage.getItem('credits')) {
        localStorage.setItem('credits', '30.00');
    }
    creditsSpan.textContent = localStorage.getItem('credits');
    initMap();
}

// Handle login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username-input').value;
    if (username) {
        localStorage.setItem('username', username);
        localStorage.setItem('credits', '30.00');
        location.reload(); // Reload to show map
    }
});

function initMap() {
    const map = L.map('map').setView([45.5231, -122.6765], 12); // Center on Portland

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19, // Allows a lot of zooming
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

    // Generate random parking spots within Portland metro bounds
    const minLat = 45.3;
    const maxLat = 45.7;
    const minLng = -123.0;
    const maxLng = -122.3;
    const numSpots = 500; // Adjust as needed; more for density
    const spots = [];
    const markers = [];

    for (let i = 0; i < numSpots; i++) {
        const lat = minLat + Math.random() * (maxLat - minLat);
        const lng = minLng + Math.random() * (maxLng - minLng);
        const available = Math.random() > 0.3; // 70% available
        spots.push({ lat, lng, available });
    }

    // Add markers
    spots.forEach((spot, index) => {
        const color = spot.available ? 'green' : 'red';
        const marker = L.circleMarker([spot.lat, spot.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            radius: 6
        }).addTo(map);

        marker.on('click', () => {
            if (!spot.available) {
                marker.bindPopup('<b>Spot Full</b>').openPopup();
                return;
            }

            // Calculate crowdedness and price
            const nearby = spots.filter(s => {
                const dist = Math.sqrt(Math.pow(s.lat - spot.lat, 2) + Math.pow(s.lng - spot.lng, 2));
                return dist < 0.01; // Approx 1km radius
            });
            const fullCount = nearby.filter(s => !s.available).length;
            const crowdedRatio = nearby.length > 0 ? fullCount / nearby.length : 0;
            const price = (1 + 4 * crowdedRatio).toFixed(2); // Price from $1 to $5

            // Popup with pay button
            const popupContent = `
                <b>Parking Spot</b><br>
                Area Pricing: $${price} / hour<br>
                <button class="btn btn-sm btn-primary mt-2" id="pay-btn-${index}" style="background-color: #6c3bf2; border-color: #6c3bf2;">Pay with Credits</button>
            `;
            marker.bindPopup(popupContent).openPopup();

            // Add event listener to pay button (use timeout to ensure DOM insertion)
            setTimeout(() => {
                const payBtn = document.getElementById(`pay-btn-${index}`);
                if (payBtn) {
                    payBtn.addEventListener('click', () => {
                        let credits = parseFloat(localStorage.getItem('credits'));
                        if (credits >= parseFloat(price)) {
                            credits -= parseFloat(price);
                            localStorage.setItem('credits', credits.toFixed(2));
                            creditsSpan.textContent = credits.toFixed(2);
                            alert('Payment successful! Spot reserved.');
                            spot.available = false;
                            marker.setStyle({ color: 'red', fillColor: 'red' });
                            marker.closePopup();
                        } else {
                            alert('Insufficient credits!');
                        }
                    });
                }
            }, 100);
        });

        markers.push(marker);
    });
}
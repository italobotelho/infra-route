const latPadrao = -23.5505;
const lngPadrao = -46.6333;

function initMap() {
    const mapElement = document.getElementById("map-canvas");
    if (!mapElement || typeof google === "undefined") return;

    const map = new google.maps.Map(
        mapElement,
        {
            center: {
                lat: latPadrao,
                lng: lngPadrao
            },
            zoom: 12
        }
    );
}

window.initMap = initMap;

const apiKey = window.INFRAROUTE_CONFIG?.GOOGLE_MAPS_API_KEY;
if (apiKey) {
    const googleMapsScript = document.createElement("script");
    googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initMap`;
    googleMapsScript.async = true;
    document.head.appendChild(googleMapsScript);
}

const googleMapsScript = document.createElement("script");

googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&callback=initMap`;

googleMapsScript.async = true;

document.head.appendChild(googleMapsScript);

const latPadrao = -23.5505
const lngPadrao = -46.6333


function initMap() {
    const map = new google.maps.Map(
        document.getElementById("map"),
        {
            center: {
                lat: latPadrao,
                lng: lngPadrao
            },
            zoom: 12
        }
    );
}


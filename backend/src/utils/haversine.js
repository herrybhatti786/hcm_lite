const geolib = require('geolib');

function verifyOfficeLocation(userLat, userLng, userAccuracy, officeLat, officeLng, officeRadiusMeters) {
  if (
    userLat === undefined || userLat === null ||
    userLng === undefined || userLng === null ||
    isNaN(Number(userLat)) || isNaN(Number(userLng))
  ) {
    return {
      allowed: false,
      reason: 'GPS coordinates could not be retrieved. Please allow location permissions in your browser.',
      distance: null
    };
  }

  // Check accuracy
  if (userAccuracy !== undefined && userAccuracy !== null && !isNaN(Number(userAccuracy)) && Number(userAccuracy) > 100) {
    return {
      allowed: false,
      reason: `GPS accuracy is too low (${Math.round(userAccuracy)}m > 100m limit). Please move to an open area or enable high accuracy.`,
      distance: null
    };
  }

  const officeCoords = { latitude: Number(officeLat), longitude: Number(officeLng) };
  const userCoords = { latitude: Number(userLat), longitude: Number(userLng) };

  try {
    const distance = geolib.getDistance(officeCoords, userCoords);
    const isInside = distance <= Number(officeRadiusMeters);

    return {
      allowed: isInside,
      distance: distance,
      radius: Number(officeRadiusMeters),
      reason: isInside ? 'Within office radius' : `Outside office geofence (${distance}m away, allowed: ${officeRadiusMeters}m)`
    };
  } catch (err) {
    return {
      allowed: false,
      reason: `Location calculation error: ${err.message}`,
      distance: null
    };
  }
}

module.exports = {
  verifyOfficeLocation
};

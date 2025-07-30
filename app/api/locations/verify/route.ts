import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

// Helper function to format distance
function formatDistance(distance: number): string {
  if (distance < 0.1) {
    return `${Math.round(distance * 5280)} ft`;
  }
  return `${distance.toFixed(2)} mi`;
}

// Validate coordinate ranges
function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { 
          error: 'Latitude and longitude required', 
          code: 'VALIDATION_ERROR' 
        },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { 
          error: 'Invalid coordinates - must be valid numbers', 
          code: 'VALIDATION_ERROR' 
        },
        { status: 400 }
      );
    }

    if (!isValidCoordinate(latitude, longitude)) {
      return NextResponse.json(
        { 
          error: 'Invalid coordinate range', 
          code: 'VALIDATION_ERROR' 
        },
        { status: 400 }
      );
    }

    // Connect to Supabase
    const supabase = await createServerClient();

    // Fetch all active locations
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, name, latitude, longitude, radius_miles, address, city, state')
      .eq('is_active', true);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch locations', 
          code: 'DATABASE_ERROR' 
        },
        { status: 500 }
      );
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        location_id: null,
        name: null,
        can_join: false,
        distance: null,
        message: 'No Side Hustle Bar locations are currently active'
      });
    }

    // Find nearest location
    let nearestLocation = null;
    let shortestDistance = Infinity;

    for (const location of locations) {
      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(String(location.latitude)),
        parseFloat(String(location.longitude))
      );

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestLocation = {
          ...location,
          distance
        };
      }
    }

    if (!nearestLocation) {
      return NextResponse.json({
        location_id: null,
        name: null,
        can_join: false,
        distance: null,
        message: 'No Side Hustle Bar locations found'
      });
    }

    // Check if user can join based on location radius
    const radiusMiles = nearestLocation.radius_miles ? parseFloat(String(nearestLocation.radius_miles)) : 0.25;
    const canJoin = shortestDistance <= radiusMiles;

    // Format full address
    const fullAddress = [
      nearestLocation.address,
      nearestLocation.city,
      nearestLocation.state
    ].filter(Boolean).join(', ');

    return NextResponse.json({
      location_id: nearestLocation.id,
      name: nearestLocation.name,
      can_join: canJoin,
      distance: Math.round(shortestDistance * 1000) / 1000, // Round to 3 decimal places
      formatted_distance: formatDistance(shortestDistance),
      address: fullAddress,
      radius_miles: radiusMiles,
      coordinates: {
        latitude: parseFloat(String(nearestLocation.latitude)),
        longitude: parseFloat(String(nearestLocation.longitude))
      }
    });

  } catch (error) {
    console.error('Location verification error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error during location verification', 
        code: 'LOCATION_ERROR',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
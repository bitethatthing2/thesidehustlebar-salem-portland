'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Shield, AlertTriangle, Check, X, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUser, type DatabaseUser } from '@/hooks/useUser';
import { toast } from 'sonner';

// Interfaces for type safety
interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_miles: number | null;
  address?: string;
  city?: string;
  state?: string;
}

interface GeolocationState {
  permission: 'prompt' | 'granted' | 'denied';
  position: GeolocationPosition | null;
  error: string | null;
  isLoading: boolean;
}

interface WolfPackInvitation {
  show: boolean;
  location: Location | null;
  distance: number;
}

// Utility functions
const clearCorruptedAuthCookies = () => {
  if (typeof document !== 'undefined') {
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
  }
};

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

const joinWolfPackFromLocation = async (locationId: string, user: DatabaseUser) => {
  if (!user?.id || !locationId) {
    throw new Error('Invalid user reference or location ID');
  }

  try {
    const { data, error } = await supabase
      .from('wolfpack_whitelist')
      .insert({
        user_id: user.id,
        location_id: locationId,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error joining wolf pack:', error);
    throw error;
  }
};

// Initialize error handling for corrupted cookies
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message?.includes('Failed to parse cookie')) {
      clearCorruptedAuthCookies();
      window.location.reload();
    }
  });
}

export function GeolocationActivation() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [geoState, setGeoState] = useState<GeolocationState>({
    permission: 'prompt',
    position: null,
    error: null,
    isLoading: false
  });
  const [invitation, setInvitation] = useState<WolfPackInvitation>({
    show: false,
    location: null,
    distance: 0
  });
  const [isWolfPackMember, setIsWolfPackMember] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Check if user is already an active WolfPack member
  useEffect(() => {
    async function checkMembershipStatus() {
      if (!user?.id) return;

      try {
        // First get the member data from users table
        const { data: memberData, error: memberError } = await supabase
          .from("users")
          .select("id, location_id, is_wolfpack_member, wolfpack_status")
          .eq('id', user.id)
          .eq('wolfpack_status', 'active')
          .eq('is_wolfpack_member', true)
          .maybeSingle();

        if (memberError || !memberData) {
          setIsWolfPackMember(false);
          setCurrentLocation(null);
          return;
        }

        // Then get the location name separately
        const { data: locationData, error: locationError } = await supabase
          .from("locations")
          .select("name")
          .eq('id', memberData.location_id!)
          .single();

        if (!locationError && locationData) {
          setIsWolfPackMember(true);
          setCurrentLocation(locationData.name);
        } else {
          setIsWolfPackMember(true);
          setCurrentLocation(null);
        }
      } catch (error) {
        console.error('Error checking WolfPack membership:', error);
        setIsWolfPackMember(false);
        setCurrentLocation(null);
      }
    }

    if (!userLoading && user) {
      void checkMembershipStatus();
    }
  }, [user, userLoading]);

  // Stop location monitoring
  const stopLocationMonitoring = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Check proximity to Side Hustle locations
  const checkProximityToBar = useCallback(async (position: GeolocationPosition) => {
    try {
      // Check if wolfpack is available (11 AM - 2:30 AM)
      const now = new Date();
      const hour = now.getHours();
      const isWolfpackActive = hour >= 11 || hour < 2 || (hour === 2 && now.getMinutes() < 30);
      
      if (!isWolfpackActive) return;

      const { data: locations, error } = await supabase
        .from('locations')
        .select('*');

      if (error || !locations) return;

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      for (const location of locations as Location[]) {
        const distance = calculateDistance(userLat, userLng, location.latitude, location.longitude);
        
        // Skip location if radius_miles is null or undefined
        if (location.radius_miles == null) {
          continue;
        }
        
        const radiusInMeters = location.radius_miles * 1609.34; // Convert miles to meters
        
        // Check if user is within geofence and not already a member
        if (distance <= radiusInMeters && !isWolfPackMember) {
          setInvitation({
            show: true,
            location: location,
            distance: Math.round(distance)
          });
          
          // Show notification
          toast.info(`You're near ${location.name}!`, {
            description: 'Join the WolfPack to unlock exclusive features'
          });
          break;
        }
      }
    } catch (error) {
      console.error('Error checking location proximity:', error);
    }
  }, [isWolfPackMember]);

  // Start monitoring location
  const startLocationMonitoring = useCallback(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setGeoState(prev => ({ ...prev, position, error: null }));
        void checkProximityToBar(position);
      },
      (error) => {
        setGeoState(prev => ({ ...prev, error: error.message }));
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000 // Cache position for 1 minute
      }
    );

    setWatchId(id);
  }, [checkProximityToBar]);

  // Request location permission
  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      setGeoState(prev => ({ ...prev, error: 'Geolocation is not supported by this browser' }));
      return;
    }

    setGeoState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setGeoState(prev => ({ ...prev, permission: permission.state as 'prompt' | 'granted' | 'denied' }));

      if (permission.state === 'granted') {
        startLocationMonitoring();
      } else if (permission.state === 'prompt') {
        // Request permission by trying to get position
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGeoState(prev => ({ 
              ...prev, 
              position, 
              permission: 'granted',
              isLoading: false 
            }));
            startLocationMonitoring();
          },
          (error) => {
            setGeoState(prev => ({ 
              ...prev, 
              error: error.message,
              permission: 'denied',
              isLoading: false 
            }));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
      } else {
        setGeoState(prev => ({ 
          ...prev, 
          error: 'Location permission denied',
          isLoading: false 
        }));
      }
    } catch {
      setGeoState(prev => ({ 
        ...prev, 
        error: 'Failed to request location permission',
        isLoading: false 
      }));
    }
  };

  // Join WolfPack from geolocation invitation
  const handleJoinWolfPack = async () => {
    if (!user || !invitation.location) {
      toast.error('Authentication error');
      return;
    }

    try {
      await joinWolfPackFromLocation(invitation.location.id, user);
      
      // Update local state
      setIsWolfPackMember(true);
      setCurrentLocation(invitation.location.name);
      setInvitation({ show: false, location: null, distance: 0 });
      
      toast.success('Welcome to the WolfPack!', {
        description: `You've joined the ${invitation.location.name} pack`
      });

      // Navigate to wolfpack main page
      router.push('/wolfpack');
    } catch (error) {
      console.error('Error joining wolf pack:', error);
      
      let errorMessage = 'Failed to join WolfPack';
      if (error instanceof Error) {
        if (error.message.includes('Permission denied')) {
          errorMessage = 'Permission error. Please try logging out and back in.';
        } else if (error.message.includes('Invalid user reference')) {
          errorMessage = 'Authentication error. Please try logging out and back in.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationMonitoring();
    };
  }, [stopLocationMonitoring]);

  return (
    <div className="space-y-4">
      {/* Location Permission Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Services
          </CardTitle>
          <CardDescription>
            Enable location access to automatically join WolfPack when you visit Side Hustle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {geoState.permission === 'prompt' && (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Location permission is required for automatic WolfPack activation
                </AlertDescription>
              </Alert>
              <Button 
                onClick={requestLocationPermission}
                disabled={geoState.isLoading}
                className="w-full"
              >
                {geoState.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Requesting Permission...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Enable Location Services
                  </>
                )}
              </Button>
            </div>
          )}

          {geoState.permission === 'granted' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Location services enabled</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              {geoState.position && (
                <p className="text-xs text-muted-foreground">
                  Monitoring your location for nearby Side Hustle locations
                </p>
              )}
              <Button
                variant="outline"
                onClick={stopLocationMonitoring}
                size="sm"
              >
                <X className="mr-2 h-3 w-3" />
                Disable
              </Button>
            </div>
          )}

          {geoState.permission === 'denied' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Location permission denied. Please enable it in your browser settings to use automatic WolfPack activation.
              </AlertDescription>
            </Alert>
          )}

          {geoState.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{geoState.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* WolfPack Invitation */}
      {invitation.show && invitation.location && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              WolfPack Invitation
            </CardTitle>
            <CardDescription>
              You&apos;re {invitation.distance}m from {invitation.location.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Join the WolfPack to unlock exclusive features while you&apos;re here!
            </p>
            <div className="flex gap-2">
              <Button onClick={handleJoinWolfPack} className="flex-1">
                <Shield className="mr-2 h-4 w-4" />
                Join WolfPack
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setInvitation({ show: false, location: null, distance: 0 })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WolfPack Status */}
      {isWolfPackMember && currentLocation && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="font-medium">You&apos;re in the {currentLocation} WolfPack!</span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Enjoying exclusive features: chat, profile, and menu access
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => router.push('/wolfpack/chat')}>
                <Users className="mr-2 h-3 w-3" />
                Open Chat
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push('/profile')}>
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
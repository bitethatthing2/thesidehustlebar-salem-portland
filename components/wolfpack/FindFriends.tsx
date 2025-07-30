'use client';

import { useState, useEffect } from 'react';
import { Search, QrCode, UserPlus, Users, Facebook, ArrowLeft, ChevronRight, Phone, Share2, MoreHorizontal, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { wolfpackSocialService } from '@/lib/services/wolfpack';
import { toast } from '@/components/ui/use-toast';

interface WolfpackUser {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  location?: string;
  is_verified?: boolean;
  mutual_friends?: number;
  is_following?: boolean;
  follower_count?: number;
}

interface FindFriendsProps {
  onClose: () => void;
}

export default function FindFriends({ onClose }: FindFriendsProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<WolfpackUser[]>([]);
  const [searchResults, setSearchResults] = useState<WolfpackUser[]>([]);
  const [contactsCount, setContactsCount] = useState(259);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  // Load suggested users from database
  useEffect(() => {
    const loadSuggestions = async () => {
      if (!user) return;
      
      try {
        setLoadingSuggestions(true);
        const users = await wolfpackSocialService.findFriends(user.id);
        
        // Transform to component format
        const transformed = users.map(u => ({
          id: u.id,
          first_name: u.first_name || 'Wolf',
          last_name: u.last_name || 'Member',
          username: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'wolfmember',
          avatar_url: u.avatar_url || '/icons/wolf-icon-light-screen.png',
          bio: 'Wolf Pack Member',
          location: 'Salem, OR',
          is_verified: false,
          mutual_friends: 0,
          is_following: u.is_following || false,
          follower_count: u.followers_count || 0
        }));
        
        setSuggestedUsers(transformed);
      } catch (error) {
        console.error('Error loading suggestions:', error);
        toast({
          title: 'Error',
          description: 'Failed to load suggestions',
          variant: 'destructive'
        });
      } finally {
        setLoadingSuggestions(false);
      }
    };
    
    loadSuggestions();
  }, [user]);

  const handleSearch = async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const users = await wolfpackSocialService.findFriends(user.id, query);
      
      // Transform to component format
      const transformed = users.map(u => ({
        id: u.id,
        first_name: u.first_name || 'Wolf',
        last_name: u.last_name || 'Member',
        username: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'wolfmember',
        avatar_url: u.avatar_url || '/icons/wolf-icon-light-screen.png',
        bio: 'Wolf Pack Member',
        location: 'Salem, OR',
        is_verified: false,
        mutual_friends: 0,
        is_following: u.is_following || false,
        follower_count: u.followers_count || 0
      }));
      
      setSearchResults(transformed);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Error',
        description: 'Search failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUser = async (userId: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to follow users',
        variant: 'destructive'
      });
      return;
    }
    
    // Optimistic update
    const updateList = (list: WolfpackUser[]) => 
      list.map(u => 
        u.id === userId 
          ? { ...u, is_following: !u.is_following }
          : u
      );
    
    setSuggestedUsers(prev => updateList(prev));
    setSearchResults(prev => updateList(prev));
    
    // Send to server
    const result = await wolfpackSocialService.toggleFollow(user.id, userId);
    
    if (!result.success) {
      // Revert on error
      setSuggestedUsers(prev => updateList(prev));
      setSearchResults(prev => updateList(prev));
      
      toast({
        title: 'Error',
        description: 'Failed to update follow status',
        variant: 'destructive'
      });
    } else {
      toast({
        title: result.following ? 'Following' : 'Unfollowed',
        description: result.following ? 'You are now following this user' : 'You have unfollowed this user'
      });
    }
  };

  const handleQRCode = () => {
    // TODO: Implement QR code functionality
    console.log('Show QR code');
  };

  const handleInviteFriends = () => {
    // TODO: Implement invite friends functionality
    console.log('Invite friends functionality');
  };

  const handleFindContacts = () => {
    // TODO: Implement find contacts functionality
    console.log('Find contacts functionality');
  };

  const handleFindFacebook = () => {
    // TODO: Implement Facebook integration
    console.log('Find Facebook friends functionality');
  };

  const renderUserCard = (user: WolfpackUser) => (
    <div key={user.id} className="bg-gray-50 rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <Avatar className="w-12 h-12">
            <Image
              src={user.avatar_url}
              alt={`${user.first_name} ${user.last_name}`}
              width={48}
              height={48}
              className="rounded-full"
            />
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {user.username}
              </h3>
              {user.is_verified && (
                <span className="text-blue-500 text-xs">✓</span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">
              {user.bio || `${user.first_name} ${user.last_name}`}
            </p>
            {user.mutual_friends && (
              <p className="text-xs text-gray-400 mt-1 flex items-center">
                <span className="w-4 h-4 bg-gray-400 rounded-full mr-1"></span>
                Friends with {user.mutual_friends}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* User's recent content preview */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square bg-gray-200 rounded-lg relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-red-500 rounded-lg opacity-20"></div>
            <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
              New
            </div>
          </div>
        ))}
      </div>
      
      {/* Action buttons */}
      <div className="flex space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs font-medium rounded-lg py-1"
        >
          Remove
        </Button>
        <Button
          onClick={() => handleFollowUser(user.id)}
          size="sm"
          className={`flex-1 text-xs font-medium rounded-lg py-1 ${
            user.is_following
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {user.is_following ? 'Following' : 'Follow back'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black text-white z-50 flex flex-col relative overflow-hidden">
      {/* Wolf Pack Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-black to-red-900/10" />
        <div className="absolute top-10 left-10 w-32 h-32 bg-red-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-red-500/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-red-500/20 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-900/20 transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold text-white">🐺 Find Pack Members</h1>
          </div>
          <button className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-900/20 transition-colors">
            <Scan className="h-6 w-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-red-500/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search by name or username"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className="pl-10 pr-4 py-3 bg-gray-900/50 border border-red-500/30 rounded-full text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-400 backdrop-blur-sm"
            />
          </div>
        </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {searchQuery ? (
          /* Search Results */
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Search Results
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map(user => renderUserCard(user))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No users found for "{searchQuery}"
              </div>
            )}
          </div>
        ) : (
          /* Main Content */
          <div className="p-4">
            {/* Action Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={handleQRCode}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                    <QrCode className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Use QR code</h3>
                    <p className="text-sm text-gray-500">Show or scan each other's QR codes.</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={handleInviteFriends}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Share2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Invite friends</h3>
                    <p className="text-sm text-gray-500">Share your profile to connect.</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={handleFindContacts}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Find contacts</h3>
                    <p className="text-sm text-gray-500">Sync or find contacts.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">{contactsCount}</span>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </button>

              <button
                onClick={handleFindFacebook}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Find Facebook friends</h3>
                    <p className="text-sm text-gray-500">Sync or find Facebook friends.</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Suggested Accounts */}
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
              </div>
            ) : suggestedUsers.length > 0 ? (
              <>
                {/* New suggested account */}
                {suggestedUsers.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-3">{suggestedUsers.filter(u => !u.is_following).length} new suggested accounts</p>
                    {suggestedUsers.slice(0, 1).map(user => renderUserCard(user))}
                  </div>
                )}

                {/* All Suggested Accounts */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Suggested accounts</h2>
                    <button className="text-sm text-gray-500 hover:text-gray-700">
                      See all
                    </button>
                  </div>
                  
                  {suggestedUsers.slice(1).map(user => renderUserCard(user))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No suggestions available</p>
                <p className="text-sm text-gray-400 mt-1">Start following people to see suggestions</p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
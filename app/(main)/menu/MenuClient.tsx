'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  UtensilsCrossed, 
  Wine, 
  AlertCircle, 
  RefreshCw,
  ArrowLeft,
  ShoppingCart,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import MenuCategoryNav from '@/components/menu/MenuCategoryNav';
import MenuItemCard, { CompactMenuItemCard } from '@/components/menu/MenuItemCard';
import MenuSearch from '@/components/menu/MenuSearch';
import Cart from '@/components/cart/Cart';
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import type {
  MenuCategoryWithCount,
  MenuItemWithModifiers,
  CartOrderData
} from '@/types/features/menu';

// Basic types for cart functionality
export interface ItemCustomization {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export function createCartItem(menuItem: MenuItemWithModifiers, customizations: ItemCustomization[] = []) {
  return {
    id: menuItem.id,
    name: menuItem.name,
    price: menuItem.price,
    quantity: 1,
    customizations
  };
}

interface MenuClientProps {
  initialCategories: MenuCategoryWithCount[];
  initialFoodCategories: MenuCategoryWithCount[];
  initialDrinkCategories: MenuCategoryWithCount[];
}

export default function MenuClient({ 
  initialCategories, 
  initialFoodCategories, 
  initialDrinkCategories 
}: MenuClientProps) {
  const [activeTab, setActiveTab] = useState<'food' | 'drink'>('food');
  const [categories] = useState<MenuCategoryWithCount[]>(initialCategories);
  const [items, setItems] = useState<MenuItemWithModifiers[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItemWithModifiers[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCompactView, setUseCompactView] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Cart management
  const { cartCount, addToCart } = useCart();
  const { user } = useAuth();

  // Initialize client-side state
  useEffect(() => {
    // Check if mobile device (mobile-first approach)
    const checkMobile = () => {
      setUseCompactView(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize active category
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      const firstFoodCategory = categories.find(cat => cat.type === 'food');
      const selectedCategory = firstFoodCategory?.id || categories[0].id;
      console.log('🎯 Setting initial active category:', selectedCategory);
      setActiveCategory(selectedCategory);
    }
  }, [categories, activeCategory]);

  // Fetch menu items for active category via API
  const fetchMenuItems = useCallback(async (categoryId: string) => {
    if (!categoryId) return;

    try {
      setLoading(true);
      setError(null);

      console.log('🍽️ Fetching items for category:', categoryId);

      // Call the API endpoint
      const response = await fetch(`/api/menu-items/${categoryId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const itemsData = await response.json();

      setItems(itemsData);
      console.log('✅ Items loaded for category:', categoryId, 'Count:', itemsData.length);

    } catch (err) {
      console.error('Error fetching menu items:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load menu items: ${errorMessage}`);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle filtered items from search
  const handleFilteredItemsChange = useCallback((newFilteredItems: MenuItemWithModifiers[]) => {
    setFilteredItems(newFilteredItems);
  }, []);

  // Handle search state change
  const handleSearchStateChange = useCallback((searching: boolean) => {
    setIsSearching(searching);
  }, []);

  // Update items when active category changes
  useEffect(() => {
    if (activeCategory) {
      fetchMenuItems(activeCategory);
    }
  }, [activeCategory, fetchMenuItems]);

  // Update filtered items when items change and not searching
  useEffect(() => {
    if (!isSearching) {
      setFilteredItems(items);
    }
  }, [items, isSearching]);

  // Update active category when tab changes
  useEffect(() => {
    if (categories.length === 0) return;

    const currentCategory = categories.find(cat => cat.id === activeCategory);
    
    if (!currentCategory || currentCategory.type !== activeTab) {
      const firstCategoryInTab = categories.find(cat => cat.type === activeTab);
      if (firstCategoryInTab) {
        setActiveCategory(firstCategoryInTab.id);
      }
    }
  }, [activeTab, categories, activeCategory]);

  // Handle add to cart
  const handleAddToCart = useCallback((orderData: CartOrderData) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to add items to your cart.",
      });
      return;
    }

    // Find the menu item to get image_url
    const menuItem = items.find(item => item.id === orderData.item.id);
    
    // Convert modifiers to unified customizations structure
    const customizations: ItemCustomization = {
      meat: orderData.modifiers.meat,
      sauces: orderData.modifiers.sauces || [],
      special_instructions: orderData.specialInstructions
    };

    // Create cart item using unified utility function
    const cartItem = createCartItem(
      {
        id: orderData.item.id,
        name: orderData.item.name,
        price: orderData.item.price,
        image_url: menuItem?.image_url || undefined
      },
      orderData.quantity,
      customizations
    );

    addToCart(cartItem);
  }, [user, addToCart, items]);

  // Handle checkout
  const handleCheckout = useCallback(async (cartItems: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
    notes?: string;
    modifiers?: {
      meat?: { id: string; name: string; price_adjustment: number } | null;
      sauces?: Array<{ id: string; name: string; price_adjustment: number }>;
    };
  }>, notes: string, total: number) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: cartItems,
        notes,
        total
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to place order');
    }

    return response.json();
  }, [user]);

  // Mobile-first loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {/* Items skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );

  // Filter categories by type
  const foodCategories = initialFoodCategories;
  const drinkCategories = initialDrinkCategories;

  // Error state
  if (error) {
    return (
      <div className="min-h-screen p-4">
        <Alert variant="destructive" className="mx-auto max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeCategory && fetchMenuItems(activeCategory)}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Debug info removed to reduce console noise

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Mobile-First Header */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-zinc-700">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.back();
              }
            }}
            className="h-10 w-10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">Menu</h1>
          
          <div className="flex items-center gap-2">
            {/* Search Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
              className={`h-10 w-10 ${showSearch ? 'text-blue-400' : ''}`}
            >
              <Search className="w-5 h-5" />
            </Button>
            
            {/* Cart Button or Login CTA */}
            {user ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCartOpen(true)}
              className="h-10 w-10 relative"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {cartCount}
                </Badge>
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/login';
                }
              }}
              className="text-xs"
            >
              Login
            </Button>
          )}
          </div>
        </div>

        {/* Search Component */}
        {showSearch && (
          <div className="px-4 pb-4">
            <MenuSearch
              items={items}
              categories={categories.filter(cat => cat.type === activeTab)}
              onFilteredItemsChange={handleFilteredItemsChange}
              onSearchStateChange={handleSearchStateChange}
            />
          </div>
        )}
      </header>

      {/* Main Tabs - Full width on mobile */}
      <div className="sticky top-[73px] z-30 bg-black border-b border-zinc-700">
        <Tabs 
          value={activeTab} 
          onValueChange={(val) => {
            const newTab = val as 'food' | 'drink';
            setActiveTab(newTab);
            // Switch to first category of the new tab
            const newCategories = newTab === 'food' ? foodCategories : drinkCategories;
            if (newCategories.length > 0) {
              setActiveCategory(newCategories[0].id);
            }
          }} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 h-12 p-1 rounded-none">
            <TabsTrigger 
              value="food" 
              className="menu-main-tab-food flex items-center gap-2 text-base"
            >
              <UtensilsCrossed className="w-5 h-5" />
              <span>Food ({foodCategories.length})</span>
            </TabsTrigger>
            <TabsTrigger 
              value="drink" 
              className="menu-main-tab-drinks flex items-center gap-2 text-base"
            >
              <Wine className="w-5 h-5" />
              <span>Drinks ({drinkCategories.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Category Navigation - Horizontal scroll on mobile */}
          <div className="bg-zinc-800/50">
            <TabsContent value="food" className="m-0">
              <div className="overflow-x-auto">
                <MenuCategoryNav
                  categories={foodCategories}
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                  loading={false}
                />
              </div>
            </TabsContent>

            <TabsContent value="drink" className="m-0">
              <div className="overflow-x-auto">
                <MenuCategoryNav
                  categories={drinkCategories}
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                  loading={false}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Menu Items - Mobile optimized */}
      <main className="bottom-nav-safe">
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton />
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="menu-container">
            <div className={
              useCompactView 
                ? "space-y-2 p-4" 
                : "menu-grid"
            }>
              {filteredItems.map(item => (
                useCompactView ? (
                  <CompactMenuItemCard
                    key={item.id}
                    item={item}
                  />
                ) : (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                  />
                )
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            {isSearching ? (
              <>
                <Search className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No items match your search</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search terms</p>
              </>
            ) : (
              <>
                {activeTab === 'food' ? (
                  <UtensilsCrossed className="w-16 h-16 text-muted-foreground mb-4" />
                ) : (
                  <Wine className="w-16 h-16 text-muted-foreground mb-4" />
                )}
                <p className="text-lg text-muted-foreground">No items in this category</p>
                <p className="text-sm text-muted-foreground mt-1">Check back later!</p>
              </>
            )}
          </div>
        )}
      </main>

      {/* Cart Modal */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />
    </div>
  );
}

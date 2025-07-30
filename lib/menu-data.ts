// lib/menu-data.ts
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from './database.types';

type MenuCategory = Database['public']['Tables']['food_drink_categories']['Row'];
type MenuItem = Database['public']['Tables']['food_drink_items']['Row'];

/**
 * Fetches all menu categories from Supabase.
 * Gets categories from the 'food_drink_categories' table which contains both food and drink categories.
 * @returns {Promise<MenuCategory[]>} A promise that resolves to an array of categories.
 */
export async function getCategories(): Promise<MenuCategory[]> {
  try {
    const supabase = await createServerClient();

    // Fetch all active categories from the food_drink_categories table
    const { data: categories, error } = await supabase
      .from('food_drink_categories')
      .select('*')
      .eq('is_active', true)
      .order('type', { ascending: true }) // Group by type first (food, then drink)
      .order('display_order', { ascending: true });
     
    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error(`Failed to fetch categories: ${JSON.stringify(error)}`);
    }
     
    if (!categories || categories.length === 0) {
      console.warn('No categories found');
      return [];
    }

    return categories;
  } catch (error) {
    console.error('Unexpected error fetching categories:', error);
    throw new Error(`Failed to fetch categories: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Define types for menu items with modifiers
interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  display_order: number;
  is_default: boolean;
}

interface ModifierGroupWithOptions {
  group_name: string;
  modifier_type: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  modifiers: ModifierOption[];
}

interface MenuItemWithModifiers extends MenuItem {
  modifier_groups: ModifierGroupWithOptions[];
}

// Type for the view response
interface MenuItemWithWorkingModifiers extends MenuItem {
  modifiers?: ModifierGroupWithOptions[];
}

/**
 * Fetches menu items for a specific category, including their modifier groups.
 * Uses the get_item_modifiers function to fetch modifiers efficiently.
 * @param {string} categoryId - The UUID of the category to fetch items for.
 * @returns {Promise<MenuItemWithModifiers[]>} A promise resolving to menu items with modifiers.
 */
export async function getMenuItemsByCategory(categoryId: string): Promise<MenuItemWithModifiers[]> {
  const supabase = await createServerClient();
   
  try {
    // Fetch items with modifiers from the view
    const { data: items, error: itemsError } = await supabase
      .from('menu_items_with_working_modifiers')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_available', true)
      .order('display_order', { ascending: true });
     
    if (itemsError) {
      console.error(`Error fetching menu items for category ${categoryId}:`, itemsError);
      return [];
    }

    if (!items || items.length === 0) {
      return [];
    }

    // Cast items to the expected type
    const typedItems = items as unknown as MenuItemWithWorkingModifiers[];

    // The view returns data with modifiers already included
    const itemsWithModifiers: MenuItemWithModifiers[] = typedItems.map(item => {
      return {
        ...item,
        modifier_groups: item.modifiers || []
      };
    });

    return itemsWithModifiers;
  } catch (error) {
    console.error(`Error fetching menu items for category ${categoryId}:`, error);
    return [];
  }
}

/**
 * Alternative: Fetch menu items with inline modifier data (if you prefer not to use RPC)
 * This approach uses joins but may be less efficient for complex modifier structures
 */
export async function getMenuItemsByCategoryWithJoins(categoryId: string): Promise<MenuItemWithModifiers[]> {
  const supabase = await createServerClient();
   
  try {
    // Fetch items with modifiers from the view
    const { data: items, error } = await supabase
      .from('menu_items_with_working_modifiers')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_available', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error(`Error fetching menu items for category ${categoryId}:`, error);
      return [];
    }

    // Cast items to the expected type
    const typedItems = items as unknown as MenuItemWithWorkingModifiers[];

    // The view returns data with modifiers already properly formatted
    const transformedItems: MenuItemWithModifiers[] = (typedItems || []).map(item => {
      return {
        ...item,
        modifier_groups: item.modifiers || []
      };
    });

    return transformedItems;
  } catch (error) {
    console.error(`Error fetching menu items for category ${categoryId}:`, error);
    return [];
  }
}

/**
 * Helper function to get categories by type
 */
export async function getCategoriesByType(type: 'food' | 'drink'): Promise<MenuCategory[]> {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('food_drink_categories')
    .select('*')
    .eq('type', type)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
    
  if (error) {
    console.error(`Error fetching ${type} categories:`, error);
    return [];
  }
  
  return data || [];
}

/**
 * Get a single menu item with all its modifiers
 */
export async function getMenuItemById(itemId: string): Promise<MenuItemWithModifiers | null> {
  const supabase = await createServerClient();
  
  try {
    // Fetch the item with modifiers from the view
    const { data: item, error: itemError } = await supabase
      .from('menu_items_with_working_modifiers')
      .select('*')
      .eq('id', itemId)
      .single();
      
    if (itemError || !item) {
      console.error('Error fetching item:', itemError);
      return null;
    }
    
    // Cast to the expected type
    const typedItem = item as unknown as MenuItemWithWorkingModifiers;
    
    return {
      ...typedItem,
      modifier_groups: typedItem.modifiers || []
    };
  } catch (error) {
    console.error(`Error fetching menu item ${itemId}:`, error);
    return null;
  }
}
import { z } from "zod";

/**
 * OpenSea API Service
 * Integrates with OpenSea API to fetch and display NFT collections, listings, and offers
 * API Key: 042jTeyVQu3mNKkaG26ihkNYchTH3aoiRE88rwPDxk6nExYX
 */

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || "042jTeyVQu3mNKkaG26ihkNYchTH3aoiRE88rwPDxk6nExYX";
const OPENSEA_BASE_URL = "https://api.opensea.io/api/v2";

// Memory NFT collection address (placeholder — will be updated with actual collection)
const MEMORY_NFT_COLLECTION = "0x0000000000000000000000000000000000000000";

export interface NFTListing {
  id: string;
  name: string;
  description: string;
  image_url: string;
  collection_name: string;
  floor_price?: number;
  rarity_rank?: number;
  traits: Array<{ trait_type: string; value: string }>;
  owner_address: string;
  listing_price?: number;
  listing_currency?: string;
}

export interface NFTCollection {
  name: string;
  description: string;
  image_url: string;
  floor_price: number;
  total_volume: number;
  item_count: number;
  owner_count: number;
}

/**
 * Fetch memory NFT collection stats from OpenSea
 */
export async function getMemoryNFTCollection(): Promise<NFTCollection | null> {
  try {
    const response = await fetch(
      `${OPENSEA_BASE_URL}/collections/${MEMORY_NFT_COLLECTION}`,
      {
        headers: {
          "X-API-KEY": OPENSEA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`OpenSea API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      name: data.collection?.name || "Memory NFTs",
      description: data.collection?.description || "",
      image_url: data.collection?.image_url || "",
      floor_price: data.collection?.floor_price || 0,
      total_volume: data.collection?.total_volume || 0,
      item_count: data.collection?.item_count || 0,
      owner_count: data.collection?.owner_count || 0,
    };
  } catch (error) {
    console.error("Failed to fetch OpenSea collection:", error);
    return null;
  }
}

/**
 * Fetch NFT listings for memory NFT collection
 */
export async function getMemoryNFTListings(
  limit: number = 20,
  offset: number = 0
): Promise<NFTListing[]> {
  try {
    const response = await fetch(
      `${OPENSEA_BASE_URL}/listings/collection/${MEMORY_NFT_COLLECTION}?limit=${limit}&offset=${offset}`,
      {
        headers: {
          "X-API-KEY": OPENSEA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`OpenSea API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.listings || []).map((listing: any) => ({
      id: listing.order_hash,
      name: listing.asset?.name || "Memory NFT",
      description: listing.asset?.description || "",
      image_url: listing.asset?.image_url || "",
      collection_name: listing.asset?.collection?.name || "Memory NFTs",
      floor_price: listing.current_price ? parseFloat(listing.current_price) : undefined,
      traits: listing.asset?.traits || [],
      owner_address: listing.maker?.address || "",
      listing_price: listing.current_price ? parseFloat(listing.current_price) : undefined,
      listing_currency: listing.payment_token?.symbol || "ETH",
    }));
  } catch (error) {
    console.error("Failed to fetch OpenSea listings:", error);
    return [];
  }
}

/**
 * Fetch offers for a specific NFT
 */
export async function getNFTOffers(
  contractAddress: string,
  tokenId: string
): Promise<Array<{ price: number; maker: string; expiration: number }>> {
  try {
    const response = await fetch(
      `${OPENSEA_BASE_URL}/offers/collection/${contractAddress}/${tokenId}`,
      {
        headers: {
          "X-API-KEY": OPENSEA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`OpenSea API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.offers || []).map((offer: any) => ({
      price: parseFloat(offer.consideration?.[0]?.startAmount || 0),
      maker: offer.offerer,
      expiration: offer.endTime || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch OpenSea offers:", error);
    return [];
  }
}

/**
 * Search for NFTs by collection and query
 */
export async function searchMemoryNFTs(query: string, limit: number = 10): Promise<NFTListing[]> {
  try {
    const response = await fetch(
      `${OPENSEA_BASE_URL}/listings/collection/${MEMORY_NFT_COLLECTION}?limit=${limit}`,
      {
        headers: {
          "X-API-KEY": OPENSEA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`OpenSea API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    // Client-side filtering by query
    return (data.listings || [])
      .filter(
        (listing: any) =>
          listing.asset?.name?.toLowerCase().includes(query.toLowerCase()) ||
          listing.asset?.description?.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map((listing: any) => ({
        id: listing.order_hash,
        name: listing.asset?.name || "Memory NFT",
        description: listing.asset?.description || "",
        image_url: listing.asset?.image_url || "",
        collection_name: listing.asset?.collection?.name || "Memory NFTs",
        floor_price: listing.current_price ? parseFloat(listing.current_price) : undefined,
        traits: listing.asset?.traits || [],
        owner_address: listing.maker?.address || "",
        listing_price: listing.current_price ? parseFloat(listing.current_price) : undefined,
        listing_currency: listing.payment_token?.symbol || "ETH",
      }));
  } catch (error) {
    console.error("Failed to search OpenSea NFTs:", error);
    return [];
  }
}

/**
 * Get collection floor price and stats
 */
export async function getMemoryNFTStats(): Promise<{
  floorPrice: number;
  volume24h: number;
  totalVolume: number;
  itemCount: number;
  ownerCount: number;
} | null> {
  try {
    const collection = await getMemoryNFTCollection();
    if (!collection) return null;

    return {
      floorPrice: collection.floor_price,
      volume24h: 0, // OpenSea API v2 doesn't provide 24h volume directly
      totalVolume: collection.total_volume,
      itemCount: collection.item_count,
      ownerCount: collection.owner_count,
    };
  } catch (error) {
    console.error("Failed to fetch OpenSea stats:", error);
    return null;
  }
}

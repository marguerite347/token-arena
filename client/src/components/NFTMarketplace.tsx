import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, Users, Zap } from "lucide-react";

interface NFTListing {
  id: string;
  name: string;
  description: string;
  image_url: string;
  collection_name: string;
  floor_price?: number;
  traits: Array<{ trait_type: string; value: string }>;
  owner_address: string;
  listing_price?: number;
  listing_currency?: string;
}

export function NFTMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);

  // Fetch collection stats
  const { data: stats, isLoading: statsLoading } = trpc.nft.stats.useQuery();

  // Fetch listings
  const { data: listings, isLoading: listingsLoading } = trpc.nft.listings.useQuery({
    limit: 12,
    offset,
  });

  // Search NFTs
  const { data: searchResults, isLoading: searchLoading } = trpc.nft.search.useQuery(
    { query: searchQuery, limit: 12 },
    { enabled: searchQuery.length > 0 }
  );

  const displayListings = searchQuery.length > 0 ? searchResults : listings;
  const isLoading = searchQuery.length > 0 ? searchLoading : listingsLoading;

  return (
    <div className="space-y-6">
      {/* Collection Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-900/20 to-purple-900/5 border-purple-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-purple-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Floor Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-100">
                {stats.floorPrice ? `${stats.floorPrice.toFixed(3)} ETH` : "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/20 to-blue-900/5 border-blue-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-300 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-100">
                {stats.totalVolume ? `${stats.totalVolume.toFixed(1)} ETH` : "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-900/20 to-cyan-900/5 border-cyan-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-cyan-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-100">{stats.itemCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-900/20 to-pink-900/5 border-pink-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-pink-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Owners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-100">{stats.ownerCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle>Search Memory NFTs</CardTitle>
          <CardDescription>Find agent memories and collectibles</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by name or description..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOffset(0);
            }}
            className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
          />
        </CardContent>
      </Card>

      {/* NFT Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-100">
          {searchQuery ? "Search Results" : "Featured Listings"}
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : displayListings && displayListings.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayListings.map((nft: NFTListing) => (
                <Card
                  key={nft.id}
                  className="bg-slate-800/50 border-slate-700/50 hover:border-purple-500/50 transition-all overflow-hidden group"
                >
                  {/* NFT Image */}
                  {nft.image_url && (
                    <div className="relative h-40 bg-slate-900 overflow-hidden">
                      <img
                        src={nft.image_url}
                        alt={nft.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  <CardContent className="p-3 space-y-2">
                    {/* NFT Name */}
                    <div>
                      <h4 className="font-semibold text-slate-100 truncate">{nft.name}</h4>
                      <p className="text-xs text-slate-400">{nft.collection_name}</p>
                    </div>

                    {/* Description */}
                    {nft.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{nft.description}</p>
                    )}

                    {/* Traits */}
                    {nft.traits && nft.traits.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {nft.traits.slice(0, 3).map((trait, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30"
                          >
                            {trait.trait_type}: {trait.value}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price */}
                    {nft.listing_price && (
                      <div className="pt-2 border-t border-slate-700/50">
                        <div className="text-sm font-semibold text-cyan-300">
                          {nft.listing_price.toFixed(3)} {nft.listing_currency || "ETH"}
                        </div>
                      </div>
                    )}

                    {/* View Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs mt-2 border-purple-500/50 hover:bg-purple-900/20"
                    >
                      View on OpenSea
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {!searchQuery && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setOffset(Math.max(0, offset - 12))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOffset(offset + 12)}
                  disabled={!displayListings || displayListings.length < 12}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400">No NFTs found</p>
          </div>
        )}
      </div>
    </div>
  );
}

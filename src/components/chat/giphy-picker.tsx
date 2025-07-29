
'use client';

import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid, SearchBar, SearchContext, SearchContextManager } from '@giphy/react-components';
import type { IGif } from '@giphy/react-components';
import { useContext } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const giphyFetch = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || '');

type GiphyPickerProps = {
  onSelect: (gif: IGif) => void;
  type: 'gif' | 'sticker';
};

function GiphyGrid({ onSelect, type }: { onSelect: (gif: IGif) => void; type: 'gif' | 'sticker' }) {
  const { fetchGifs, searchKey } = useContext(SearchContext);
  const mediaType = type === 'sticker' ? 'stickers' : 'gifs';
  
  return (
    <Grid
      onGifClick={onSelect}
      fetchGifs={ (offset: number) => fetchGifs(offset)}
      width={400}
      columns={3}
      gutter={6}
      key={searchKey}
      noLink={true}
      hideAttribution={true}
    />
  );
}

export function GiphyPicker({ onSelect, type }: GiphyPickerProps) {
    
    if (!process.env.NEXT_PUBLIC_GIPHY_API_KEY) {
        return (
            <div className="w-[400px] h-[300px] p-4">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Giphy API Key Missing</AlertTitle>
                    <AlertDescription>
                        Please add your Giphy API key to the .env.local file to enable this feature.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

  return (
    <SearchContextManager apiKey={process.env.NEXT_PUBLIC_GIPHY_API_KEY} options={{type: type === 'sticker' ? 'stickers' : 'gifs'}}>
        <div className="flex flex-col gap-2 p-2 w-[400px] h-[400px] bg-background">
            <SearchBar className="bg-muted border-none shadow-none focus-within:ring-0" />
            <div className="flex-1 overflow-y-auto">
                <GiphyGrid onSelect={onSelect} type={type} />
            </div>
        </div>
    </SearchContextManager>
  );
}

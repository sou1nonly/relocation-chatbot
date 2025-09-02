import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, MessageSquare, Clock, Tag, MapPin } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MemoryData {
  summary: string;
  lastUpdated: string;
  messageCount: number;
  keyTopics: string[];
  urgentQueries: string[];
  locationContext: string[];
  userPreferences?: {
    careerField?: string;
    discussedCities?: string[];
    budget?: string;
    workSetup?: string;
  };
}

interface MemoryViewerProps {
  memoryData?: MemoryData;
  isLoading?: boolean;
}

export function MemoryViewer({ memoryData, isLoading }: MemoryViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="View conversation memory"
        >
          <Brain className="h-4 w-4" />
          <span className="sr-only">View memory</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Conversation Memory
          </SheetTitle>
          <SheetDescription>
            Smart context and preferences learned from our conversation
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ) : memoryData ? (
            <>
              {/* Summary */}
              {memoryData.summary && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Conversation Summary
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {memoryData.summary}
                  </p>
                </div>
              )}

              {/* Key Topics */}
              {memoryData.keyTopics && memoryData.keyTopics.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Key Topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {memoryData.keyTopics.map((topic) => (
                      <span
                        key={`topic-${topic}`}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Location Context */}
              {memoryData.locationContext &&
                memoryData.locationContext.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Discussed Locations
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {memoryData.locationContext.map((location) => (
                        <span
                          key={`location-${location}`}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        >
                          {location}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* User Preferences */}
              {memoryData.userPreferences && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">User Preferences</h3>
                  <div className="space-y-2 text-sm">
                    {memoryData.userPreferences.careerField && (
                      <div>
                        <span className="font-medium">Career: </span>
                        <span className="text-muted-foreground">
                          {memoryData.userPreferences.careerField}
                        </span>
                      </div>
                    )}
                    {memoryData.userPreferences.workSetup && (
                      <div>
                        <span className="font-medium">Work Setup: </span>
                        <span className="text-muted-foreground">
                          {memoryData.userPreferences.workSetup}
                        </span>
                      </div>
                    )}
                    {memoryData.userPreferences.budget && (
                      <div>
                        <span className="font-medium">Budget: </span>
                        <span className="text-muted-foreground">
                          {memoryData.userPreferences.budget}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Urgent Queries */}
              {memoryData.urgentQueries &&
                memoryData.urgentQueries.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                      Recent Priority Questions
                    </h3>
                    <div className="space-y-1">
                      {memoryData.urgentQueries.map((query) => (
                        <p
                          key={`urgent-${query.slice(0, 20)}`}
                          className="text-sm text-muted-foreground bg-orange-50 dark:bg-orange-950 p-2 rounded border-l-2 border-orange-300 dark:border-orange-700"
                        >
                          {query}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

              {/* Metadata */}
              <div className="space-y-2 pt-4 border-t">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Memory Stats
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Messages: </span>
                    <span className="text-muted-foreground">
                      {memoryData.messageCount}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Updated: </span>
                    <span className="text-muted-foreground">
                      {formatDate(memoryData.lastUpdated)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No conversation memory available yet.
                <br />
                Start chatting to build context!
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

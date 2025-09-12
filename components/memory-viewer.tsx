import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Brain,
  MessageSquare,
  Tag,
  MapPin,
  Edit2,
  Save,
  X,
  Plus,
} from 'lucide-react';
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
  onMemoryUpdate?: () => void;
}

interface AddItemButtonProps {
  onAdd: (value: string) => void;
  placeholder: string;
}

function AddItemButton({ onAdd, placeholder }: AddItemButtonProps) {
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
      setIsAdding(false);
    }
  };

  if (isAdding) {
    return (
      <div className="flex gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-7 text-xs"
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          autoFocus
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          className="h-7 w-7 p-0"
        >
          <Save className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsAdding(false)}
          className="h-7 w-7 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => setIsAdding(true)}
      className="h-7 w-7 p-0"
    >
      <Plus className="h-3 w-3" />
    </Button>
  );
}

export function MemoryViewer({
  memoryData,
  isLoading,
  onMemoryUpdate,
}: MemoryViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<MemoryData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEditStart = () => {
    setEditedData(memoryData ? { ...memoryData } : null);
    setEditMode(true);
  };

  const handleEditCancel = () => {
    setEditedData(null);
    setEditMode(false);
  };

  const handleSave = async () => {
    if (!editedData) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      });

      if (response.ok) {
        setEditMode(false);
        onMemoryUpdate?.(); // Call the callback to refresh memory data
      }
    } catch (error) {
      console.error('Failed to update memory:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteItem = async (type: string, index: number) => {
    if (!editedData) return;

    const newData = { ...editedData };

    if (type === 'keyTopics') {
      newData.keyTopics = newData.keyTopics.filter((_, i) => i !== index);
    } else if (type === 'locationContext') {
      newData.locationContext = newData.locationContext.filter(
        (_, i) => i !== index,
      );
    } else if (type === 'urgentQueries') {
      newData.urgentQueries = newData.urgentQueries.filter(
        (_, i) => i !== index,
      );
    }

    setEditedData(newData);
  };

  const addNewItem = (type: string, value: string) => {
    if (!editedData || !value.trim()) return;

    const newData = { ...editedData };

    if (type === 'keyTopics') {
      newData.keyTopics = [...newData.keyTopics, value.trim()];
    } else if (type === 'locationContext') {
      newData.locationContext = [...newData.locationContext, value.trim()];
    }

    setEditedData(newData);
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
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Conversation Memory
              </SheetTitle>
              <SheetDescription>
                Smart context and preferences learned from our conversation
              </SheetDescription>
            </div>
            {memoryData && !isLoading && (
              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditCancel}
                      disabled={isUpdating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isUpdating}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleEditStart}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
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
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversation Summary
                </h3>
                {editMode ? (
                  <Textarea
                    value={editedData?.summary || ''}
                    onChange={(e) =>
                      setEditedData((prev) =>
                        prev ? { ...prev, summary: e.target.value } : null,
                      )
                    }
                    className="text-sm leading-relaxed min-h-[100px]"
                    placeholder="Enter conversation summary..."
                  />
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {memoryData.summary ||
                      'No summary available yet. Click edit to add one.'}
                  </p>
                )}
              </div>

              {/* Key Topics */}
              {(() => {
                const topics = editMode
                  ? editedData?.keyTopics
                  : memoryData.keyTopics;
                return (topics && topics.length > 0) || editMode;
              })() && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Key Topics
                    </h3>
                    {editMode && (
                      <AddItemButton
                        onAdd={(value: string) =>
                          addNewItem('keyTopics', value)
                        }
                        placeholder="Add topic"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editMode
                      ? editedData?.keyTopics
                      : memoryData.keyTopics
                    )?.map((topic, index) => (
                      <span
                        key={`topic-${topic.replace(/\s+/g, '-')}-${Date.now()}-${index}`}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground group"
                      >
                        {topic}
                        {editMode && (
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('keyTopics', index)}
                            className="ml-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Location Context */}
              {(() => {
                const locations = editMode
                  ? editedData?.locationContext
                  : memoryData.locationContext;
                return (locations && locations.length > 0) || editMode;
              })() && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Discussed Locations
                    </h3>
                    {editMode && (
                      <AddItemButton
                        onAdd={(value: string) =>
                          addNewItem('locationContext', value)
                        }
                        placeholder="Add location"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editMode
                      ? editedData?.locationContext
                      : memoryData.locationContext
                    )?.map((location, index) => (
                      <span
                        key={`location-${location.replace(/\s+/g, '-')}-${Date.now()}-${index}`}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 group"
                      >
                        {location}
                        {editMode && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteItem('locationContext', index)
                            }
                            className="ml-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* User Preferences */}
              {((editMode
                ? editedData?.userPreferences
                : memoryData.userPreferences) ||
                editMode) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">User Preferences</h3>
                  <div className="space-y-2 text-sm">
                    {/* Career Field */}
                    <div>
                      <span className="font-medium">Career: </span>
                      {editMode ? (
                        <Input
                          value={editedData?.userPreferences?.careerField || ''}
                          onChange={(e) =>
                            setEditedData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    userPreferences: {
                                      ...prev.userPreferences,
                                      careerField: e.target.value,
                                    },
                                  }
                                : null,
                            )
                          }
                          placeholder="Enter career field"
                          className="inline-flex h-6 text-xs w-40"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {memoryData.userPreferences?.careerField ||
                            'Not specified'}
                        </span>
                      )}
                    </div>
                    {/* Work Setup */}
                    <div>
                      <span className="font-medium">Work Setup: </span>
                      {editMode ? (
                        <Input
                          value={editedData?.userPreferences?.workSetup || ''}
                          onChange={(e) =>
                            setEditedData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    userPreferences: {
                                      ...prev.userPreferences,
                                      workSetup: e.target.value,
                                    },
                                  }
                                : null,
                            )
                          }
                          placeholder="Remote/Hybrid/Office"
                          className="inline-flex h-6 text-xs w-40"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {memoryData.userPreferences?.workSetup ||
                            'Not specified'}
                        </span>
                      )}
                    </div>
                    {/* Budget */}
                    <div>
                      <span className="font-medium">Budget: </span>
                      {editMode ? (
                        <Input
                          value={editedData?.userPreferences?.budget || ''}
                          onChange={(e) =>
                            setEditedData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    userPreferences: {
                                      ...prev.userPreferences,
                                      budget: e.target.value,
                                    },
                                  }
                                : null,
                            )
                          }
                          placeholder="Budget range"
                          className="inline-flex h-6 text-xs w-40"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {memoryData.userPreferences?.budget ||
                            'Not specified'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Urgent Queries */}
              {(() => {
                const queries = editMode
                  ? editedData?.urgentQueries
                  : memoryData.urgentQueries;
                return (queries && queries.length > 0) || editMode;
              })() && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                    Recent Priority Questions
                  </h3>
                  <div className="space-y-1">
                    {(editMode
                      ? editedData?.urgentQueries
                      : memoryData.urgentQueries
                    )?.map((query, index) => (
                      <div
                        key={`urgent-${query.slice(0, 20).replace(/\s+/g, '-')}-${index}`}
                        className="text-sm text-muted-foreground bg-orange-50 dark:bg-orange-950 p-2 rounded border-l-2 border-orange-300 dark:border-orange-700 group relative"
                      >
                        {query}
                        {editMode && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteItem('urgentQueries', index)
                            }
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

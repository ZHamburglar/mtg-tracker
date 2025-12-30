import { Loader2, ChevronDown, ChevronUp, Combine, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { TextWithSymbols } from '@/components/ManaSymbols';
import React, { useState, useEffect } from 'react';
export default function CombosCard({ title = 'Combos', items = [], loading = false }) {
  const [expanded, setExpanded] = useState({});
  const [expandedIncluded, setExpandedIncluded] = useState({});
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items]);

  const start = (page - 1) * pageSize;
  const pageItems = (items || []).slice(start, start + pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Combine className="h-4 w-4" />{title}: {items.length}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground text-sm">{title === 'Combos Found' ? 'No combos found' : 'No near-miss combos'}</div>
        ) : (
          <div className="space-y-3">
            {pageItems.map((item, idx) => {
                const globalIdx = start + idx;
                const header = item.title || item.name || `${title} ${globalIdx + 1}`;
                return (
                  <div key={globalIdx} className="border rounded px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium truncate">{header}</div>
                      <Button variant="ghost" size="icon" className="ml-2" onClick={() => setExpanded(prev => ({ ...prev, [globalIdx]: !prev[globalIdx] }))}>
                        {expanded[globalIdx] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {expanded[globalIdx] && (
                      <div className="mt-2 text-sm space-y-1">

                        {item.notablePrerequisites && item.notablePrerequisites.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Prerequisites:</span>
                            <TextWithSymbols text={Array.isArray(item.notablePrerequisites) ? item.notablePrerequisites.join(', ') : item.notablePrerequisites} className="text-sm text-muted-foreground" size="w-4 h-4" />
                          </div>
                        )}

                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-0">
                            <span className="font-semibold">Steps:</span>{' '}
                            <TextWithSymbols text={item.description} className="inline text-sm text-muted-foreground" size="w-4 h-4" />
                          </p>
                        )}

                        {item.produces && item.produces.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.produces.map((p, pi) => (
                              <span key={pi} className="text-xs bg-muted px-1 py-0.5 rounded">{p.feature?.name}</span>
                            ))}
                          </div>
                        )}

                        {(item.included || item.uses || item.items || []).length > 0 && (() => {
                          const includedArr = item.included || item.uses || item.items || [];
                          const limit = 6;
                          const isExpandedIncluded = !!expandedIncluded[globalIdx];

                          return (
                            <div>
                              {!isExpandedIncluded ? (
                                <div className="flex flex-wrap gap-2 items-center">
                                  {includedArr.slice(0, limit).map((inc, i) => (
                                    <span key={i} className="text-sm text-muted-foreground px-1 py-0.5 rounded">{inc.card?.name || inc.name || inc}{inc.card?.set_name ? ` (${inc.card.set_name})` : ''}</span>
                                  ))}
                                  {includedArr.length > limit && (
                                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setExpandedIncluded(prev => ({ ...prev, [globalIdx]: true }))}>
                                      +{includedArr.length - limit} more
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="max-h-40 overflow-auto p-1">
                                  <div className="flex flex-wrap gap-2">
                                    {includedArr.map((inc, i) => (
                                      <span key={i} className="text-sm text-muted-foreground px-1 py-0.5 rounded">{inc.card?.name || inc.name || inc}{inc.card?.set_name ? ` (${inc.card.set_name})` : ''}</span>
                                    ))}
                                  </div>
                                  <div className="mt-2">
                                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setExpandedIncluded(prev => ({ ...prev, [globalIdx]: false }))}>
                                      Show less
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

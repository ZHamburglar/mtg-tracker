'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, X, Plus, Minus } from 'lucide-react';

export function DropdownMultiselect({
  label,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
  options = [],
  value = [],
  onChange,
  renderOption,
  renderBadge,
  getOptionValue,
  getOptionLabel,
  grouped = false, // If true, options should be { groupName: [...items] }
  groupOrder = [], // Optional array to specify group display order
  collapsible = false, // If true, groups can be collapsed
}) {
  const [open, setOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const handleSelect = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue) => {
    onChange(value.filter(v => v !== optionValue));
  };

  return (
    <div>
      {label && <label className="text-sm font-medium mb-2 block">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value.length > 0
              ? `${value.length} selected`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {grouped ? (
                // Render grouped options
                (() => {
                  const groups = groupOrder.length > 0
                    ? groupOrder.filter(groupName => options[groupName])
                    : Object.keys(options);
                  
                  const toggleGroup = (groupName) => {
                    if (!collapsible) {return;}
                    setCollapsedGroups(prev => ({
                      ...prev,
                      [groupName]: !prev[groupName]
                    }));
                  };
                  
                  return groups.map((groupName) => {
                    const isCollapsed = collapsedGroups[groupName];
                    
                    return (
                      <div key={groupName}>
                        {collapsible ? (
                          <div 
                            className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-foreground cursor-pointer hover:bg-accent"
                            onClick={() => toggleGroup(groupName)}
                          >
                            {isCollapsed ? (
                              <Plus className="h-3 w-3" />
                            ) : (
                              <Minus className="h-3 w-3" />
                            )}
                            <span>{groupName}</span>
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 text-xs font-semibold text-foreground">
                            {groupName}
                          </div>
                        )}
                        {!isCollapsed && (
                          <CommandGroup>
                            {options[groupName].map((option) => {
                              const optionValue = getOptionValue ? getOptionValue(option) : option;
                              const optionLabel = getOptionLabel ? getOptionLabel(option) : option;
                              
                              return (
                                <CommandItem
                                  key={optionValue}
                                  value={optionValue}
                                  onSelect={() => handleSelect(optionValue)}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      value.includes(optionValue)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                  {renderOption ? renderOption(option) : <span>{optionLabel}</span>}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </div>
                    );
                  });
                })()
              ) : (
                // Render flat options
                <CommandGroup>
                  {options.map((option) => {
                    const optionValue = getOptionValue ? getOptionValue(option) : option;
                    const optionLabel = getOptionLabel ? getOptionLabel(option) : option;
                    
                    return (
                      <CommandItem
                        key={optionValue}
                        value={optionValue}
                        onSelect={() => handleSelect(optionValue)}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            value.includes(optionValue)
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        {renderOption ? renderOption(option) : <span>{optionLabel}</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => handleRemove(v)}
            >
              {renderBadge ? renderBadge(v) : v}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

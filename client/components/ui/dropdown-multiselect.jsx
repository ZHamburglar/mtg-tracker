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
import { Check, ChevronsUpDown, X } from 'lucide-react';

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
}) {
  const [open, setOpen] = useState(false);

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

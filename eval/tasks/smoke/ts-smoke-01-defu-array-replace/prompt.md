Add a named `defuArrayReplace` export.

It must behave like `defu`, except that when both the higher-priority value and
its default are arrays, the complete higher-priority array replaces the default
array instead of being concatenated.

The rule must work recursively and across multiple default objects. Preserve
the existing nullish-value rules, prototype-pollution protection, input
immutability, generic return-type contract, and every existing export and
behavior. Document the new API with a concise example.

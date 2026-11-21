---
"mobx-tanstack-query": patch
---

Defer allocating the lifecycle abort controller for queries and mutations created without an external signal until the controller is used or the instance is destroyed.

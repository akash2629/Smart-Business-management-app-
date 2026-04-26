# Firestore Security Specification - SmartShop Enterprise

## 1. Data Invariants
- **Identity Isolation**: All data collections are nested under `/users/{userId}`. No user can ever read or write to another user's path.
- **Relational Integrity**: 
  - `orders` must have a valid `customerId`.
  - `payments` must have valid `customerId` and `orderId`.
  - `products` must have unique codes (conceptually, though Firestore rules can't enforce uniqueness across docs easily without a specialized collection, we enforce schema integrity).
- **Temporal Integrity**: `createdAt` and `updatedAt` must match `request.time`.
- **System Integrity**: `reset_sessions` must be strictly protected to prevent brute-forcing or unauthorized resets.

## 2. The Dirty Dozen Payloads (Target: Deny)

1. **Identity Theft**: User A tries to write to `/users/userB/customers/123`.
2. **Shadow Field Injection**: User A adds `isVerified: true` to their own customer doc (a field not in schema).
3. **Price Manipulation**: User A updates a product price to `0.01` during an order create (if price was stored in order items, but here it's in the order doc metadata for now).
4. **Timestamp Spoofing**: User A sets `createdAt` to a year ago.
5. **Session Hijacking**: User A tries to read User B's `/users/userB/reset_sessions/current`.
6. **Privilege Escalation**: User A tries to set `isAdmin: true` in `users/{uid}/settings/theme`.
7. **Malformed ID**: User A tries to create a customer with ID `../../../etc/passwd`.
8. **Negative Stock**: User A tries to set `stock: -100`.
9. **Orphaned Payment**: User A creates a payment for a `customerId` that doesn't exist.
10. **Resource Exhaustion**: User A pushes a 1MB string into the `name` field of a product.
11. **Bulk Delete**: User A tries to delete the entire `users/{uid}` collection in one go without a batch (handled by rules blocking non-owner).
12. **Code Brute Force**: User A tries to update the `code` in `reset_sessions/current`.

## 3. Test Runner Strategy
We will implement a suite of tests that verify these denials and allows.

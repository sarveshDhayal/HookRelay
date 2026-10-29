// Binary Min-Heap Priority Queue implementation (DSA Coursework)
// Used by the delivery worker to schedule webhook retries by nextAttemptAt timestamp.
//
// Array-based Binary Tree Representation:
// For any element at index i:
//   - Parent index: Math.floor((i - 1) / 2)
//   - Left child index: 2 * i + 1
//   - Right child index: 2 * i + 2
//
// Time Complexity:
//   - push():       O(log N) - bubble up
//   - pop():        O(log N) - bubble down (extract min)
//   - peek():       O(1)     - inspect root
//   - size():       O(1)
//   - isEmpty():    O(1)
// Space Complexity: O(N) where N is the number of scheduled delivery jobs.

export class MinHeap {
  constructor(comparator = (a, b) => a.priority - b.priority) {
    this.heap = [];
    this.comparator = comparator;
  }

  // Returns number of elements in heap
  size() {
    return this.heap.length;
  }

  // Checks if heap is empty
  isEmpty() {
    return this.heap.length === 0;
  }

  // Look at the minimum element without removing it
  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  // Insert a new item into the heap: O(log N)
  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  // Extract and return the minimum item: O(log N)
  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    // Move last element to root and restore min-heap property
    this.heap[0] = this.heap.pop();
    this._bubbleDown(0);
    return min;
  }

  // Restores heap invariant upwards after insertion
  _bubbleUp(index) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      // If current is smaller than parent, swap them
      if (this.comparator(this.heap[current], this.heap[parent]) < 0) {
        this._swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  // Restores heap invariant downwards after root extraction
  _bubbleDown(index) {
    let current = index;
    const length = this.heap.length;

    while (true) {
      let smallest = current;
      const left = 2 * current + 1;
      const right = 2 * current + 2;

      if (
        left < length &&
        this.comparator(this.heap[left], this.heap[smallest]) < 0
      ) {
        smallest = left;
      }

      if (
        right < length &&
        this.comparator(this.heap[right], this.heap[smallest]) < 0
      ) {
        smallest = right;
      }

      if (smallest !== current) {
        this._swap(current, smallest);
        current = smallest;
      } else {
        break;
      }
    }
  }

  _swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  // Utility to clear heap
  clear() {
    this.heap = [];
  }
}


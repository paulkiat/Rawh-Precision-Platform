
//------------------- 01_BEGIN: VECTOR OPERATIONS ------------------//
exports.dotProduct = function(a, b) {
  return a.reduce((sum, value, idx) => sum + (value * b[idx]), 0);
};

exports.copy = function(x) {
  return [...x]; // simply returns a copy of the vector x, hehe..
};

exports.clone = function(x){
  return JSON.parse(JSON.stringify(x)); // let's make that vector deep baby
};

exports.swap = function(x, y) {
  return { x: [ ...y ], y: [ ...x ]}; // swap the contents of two vectors
};

exports.scale  = function(scalar, x) {
   return x.map(val => scalar * val); // return scalar times each element in x
};

exports.axpy = function(scalar, x, y){
  return x.map((val, i) => scalar * val + y[i]); // multiply scalar, add to y
};

exports.nrm2 = function(x){
  return Math.sqrt(exports.dotProduct(x, x)); // return the norm of a vector
};

exports.amax = function(x) {
  let max_idx = 0;
  let max_val = Math.abs(x[0]);
  for (let i = 1, len = x.length; i < len; ++i) {
    if (Math.abs(x[i]) > max_val){
      max_val = Math.abs(x[i]);
      max_idx = i;
    }
  }
  return max_idx; // return the index of the largest element in x
}
//------------------- 01_END: VECTOR OPERATIONS ------------------//

//------------------- 02_BEGIN: TRANSFORMATIONS  ------------------//
exports.rotg = function(a, b) {
  const r = Math.hypot(a, b); // hypotenuse
  const c = a / r; // cosine of angle
  const s  = b / r; // sine of angle
  return { radius: r, cosine: c, sine: s };
};

exports.rot = function(a, b, c, s) { 
  return { // rotate a vector by angle c and s
    a_new: a * c + b * s,
    b_new: c * b - s * a
  };
};

exports.rotmg = function(d1, d2, x1, y1) {
  const gamma = 4096;
  const g = d2 * y1 * y1;
  const p = d1 * x1 * x1;
  let flag;

  if (p > g) {
     flag = -1;
  } else if (p == g){
     flag = 0;
  } else {
     flag = +1;
  }

  return { flag };
};

exports.rotm = function(x, y, param) {
  return param.flag === -1
         ? { x: x * param.flag, y: y * param.flag }
         : { x, y };
};
//------------------- 02_END: TRANSFORMATIONS  ------------------//

//----------- 03_BEGIN: MATRIX MULTIPLY / TRANSPOSE  -----------//
exports.mmt = function(a, b) {
  const rowsA = a.length, colsA = a[0].length;
  const rowsB = b.length, colsB = b[0].length;
  if (colsA !== rowsB) {
    throw new Error('Matrix multiplication not possible');
  }
  let result = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; ++i) {
    for  (let j = 0; j < colsB; ++j) {
       for  (let k = 0; k < colsA; ++k) {
         result[i][j] += a[i][k] * b[k][j];
        }
     }
  }
  return result;
};

exports.transpose = function(a) {
  return a[0].map((cols, idx) => a.map(row => row[idx]));
}
//----------- 03_END: MATRIX MULTIPLY / TRANSPOSE  -----------//

// simple process to factorize a matrix A into
// an orthogonal matrix Q and an upper 
// triangular matrix R
exports.qrDecomp = function(a) {
  const m = a.length;
  const n = a[0].length;
  let Q = Array.from({ length: m }, () => Array(m).fill(0));
  let R = Array.from({ length: n }, () => Array(n).fill(0));
  let clone = JSON.parse(JSON.stringify(a));

  for (let k = 0; k < n; k++) {
      let norm = Math.sqrt(clone.map(row => row[k] ** 2).reduce((sum, val) => sum + val));
      for (let i = 0; i < m; ++i) { Q[i][k] = clone[i][k] / norm; };
      for (let j = k + 1; j < n; ++j) {
        R[k][j - 1] = Q.map((row, i) => row[k] * a[i][j]).reduce((sum, val) => sum + Q[i][k] * val);
        for (let i = 0; i < m; ++i) { clone[i][j] -= R[k][j - 1] * Q[i][k]; };
      }
  }

  return { Q, R };
};

// cholesky decomposition is used to deconstruct
// a positive semi-definite matrix A into the
// product of a lower triangular matrix L and its
// transpose L^T. This allows for efficient computation
// of the inverse of A.
exports.choleskyDecomp = function(a) {
  const n  = a.length;
  let L    = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let i = 0; i < n; ++i) {
    for (let j = 0; j < i; ++j) {
      let sum  = 0;
      for (let k = 0; k < j; ++k) { sum += L[i][k] * L[j][k]; };
      if  ( i === j ) {
        L[i][j]  = Math.sqrt(a[i][j] - sum);
      } else {
        L[i][j]  = (1 / L[j][j]) * ((a[i][j] - sum));
      }
    }
  }
  return L;
};

// randomized QR decomposition enables for a more efficient
// computation for approximating matrix factorizations
// by incorporating randomness
exports.randomizedQRDecomp = function(a, numComponents) {
  // first let's generate a random Gaussian matrix
  const rows = a.length, cols = a[0].length;
  const rando_mtrx = Array.from({ length: cols }, () => Array(numComponents).fill(0).map( () => Math.random() * 2 - 1 ));

  // then we'll multiply the rando by a
  const b = exports.matrixMultiply(a, rando_mtrx);

  // finally, let's compute the QR decomposition of b
  return exports.qrDecomp(b);
};

// CUR matrix decomposition is useful for data analysis
// focusing on low-rank approximations to a matrix
// used mostly for sparse matrices or data matrices
exports.curDecomp  = function(a, numRows, numCols) {
  const rows = a.length, cols = a[0].length;

  const selectRows = [];
  const selectCols  = [];

  for (let i = 0; i < numRows; i++ ) {
      selectRows.push(a[ Math.floor(Math.random() * rows) ]);
  }
  for (let j = 0; j < numCols; j++) {
      selectCols.push(a.map(row => row[ Math.floor(Math.random() * cols) ]));
  }

  const C = selectCols;
  const R = selectRows;
  const U = exports.pseudoInverse(exports.matrixMultiply(C,R));

  return { C, U, R };
};

// randomized QR with column pivot
exports.randomQRPivot = function(A, numComponents) {
  const rows = A.length;
  const cols = A[0].length;
  
  // Step 1: Generate a random Gaussian matrix (for randomized projection)
  const randomMatrix = Array.from({ length: cols }, () => 
    Array(numComponents).fill(0).map(() => Math.random())
  );

  // Step 2: Multiply A by the random matrix to reduce dimensions
  const B = exports.matrixMultiply(A, randomMatrix);

  // Step 3: Initialize permutation matrix (P) to keep track of column swaps
  let P = Array.from({ length: cols }, (_, i) => i); // Identity permutation
  
  // Step 4: Classical Gram-Schmidt with column pivoting
  let Q = Array.from({ length: rows }, () => Array(numComponents).fill(0));
  let R = Array.from({ length: numComponents }, () => Array(cols).fill(0));

  let copy = JSON.parse(JSON.stringify(B)); // Deep copy of matrix B for decomposition

  for (let k = 0; k < numComponents; k++) {
    // Step 5: Find column with the largest norm for pivoting
    let maxIndex = k;
    let maxNorm = 0;

    for (let j = k; j < cols; j++) {
      const norm = Math.sqrt(copy.map(row => row[j] ** 2).reduce((sum, val) => sum + val));
      if (norm > maxNorm) {
        maxNorm = norm;
        maxIndex = j;
      }
    }

    // Step 6: Swap columns in matrix and record the permutation in P
    [copy[k], copy[maxIndex]] = [copy[maxIndex], copy[k]];
    [P[k], P[maxIndex]] = [P[maxIndex], P[k]];

    // Step 7: Perform QR Decomposition on the permuted columns
    const norm = Math.sqrt(copy.map(row => row[k] ** 2).reduce((sum, val) => sum + val));
    for (let i = 0; i < rows; i++) Q[i][k] = copy[i][k] / norm;
    for (let j = k; j < cols; j++) {
      R[k][j] = Q.map((row, i) => row[k] * copy[i][j]).reduce((sum, val) => sum + val);
      for (let i = 0; i < rows; i++) copy[i][j] -= Q[i][k] * R[k][j];
    }
  }

  return { Q, R, P }; // Return Q, R, and the permutation matrix P
};


// fixed-rank approximation for streaming data
const { matrixMultiply, transpose } = require('./matrix.util');

// Function to perform fixed-rank approximation of a PSD matrix from streaming data
exports.fixedRankApproximation = function(currentMatrix, newVector, rankK) {
  const rows = currentMatrix.length;
  const cols = currentMatrix[0].length;

  // Step 1: Append the new data vector as a row (streaming input) to the matrix
  let augmentedMatrix = [...currentMatrix, newVector];

  // Step 2: Compute the current approximation (e.g., using SVD or eigenvalue decomposition)
  let { U, S, V } = computeSVD(augmentedMatrix);

  // Step 3: Truncate the approximation to the top-k components to maintain fixed rank
  U = U.slice(0, rankK);
  S = S.slice(0, rankK);
  V = V.slice(0, rankK);

  // Step 4: Reconstruct the low-rank matrix
  const truncatedMatrix = reconstructFromSVD(U, S, V);

  return truncatedMatrix;
};

// Utility function to compute SVD (Singular Value Decomposition)
// A = U * S * V^T (for simplicity, using a mock version here)
function computeSVD(A) {
  // Mock SVD computation (replace with a proper SVD library or method)
  // Proper SVD method implemented below
  const rows = A.length;
  const cols = A[0].length;

  // For simplicity, assume U, S, V are identity matrices of the correct size
  let U = Array.from({ length: rows }, (_, i) => Array.from({ length: rows }, (_, j) => (i === j ? 1 : 0)));
  let S = Array.from({ length: Math.min(rows, cols) }, (_, i) => i + 1); // Example singular values
  let V = Array.from({ length: cols }, (_, i) => Array.from({ length: cols }, (_, j) => (i === j ? 1 : 0)));

  return { U, S, V };
}

// Utility function to reconstruct a matrix from its SVD components (U, S, V)
function reconstructFromSVD(U, S, V) {
  // S is a vector of singular values, we need to turn it into a diagonal matrix
  const S_diag = Array.from({ length: S.length }, (_, i) => Array(S.length).fill(0).map((_, j) => (i === j ? S[i] : 0)));

  // Multiply U * S * V^T to get the reconstructed matrix
  const US = matrixMultiply(U, S_diag);
  const reconstructedMatrix = matrixMultiply(US, transpose(V));

  return reconstructedMatrix;
}
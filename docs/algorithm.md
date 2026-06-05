# Algorithm Documentation

## Preprocessing Pipeline

1. **Grayscale conversion** — BGR → single channel
2. **Resize** — maintain aspect ratio, target width (default 256px)
3. **Gaussian blur** — noise reduction (configurable kernel)
4. **Gradient magnitude** — Sobel-based normalization to [0, 1]

## Classical Algorithms

### Sobel

Computes gradient magnitude using 3×3 Sobel kernels in X and Y directions. Threshold applied for binary edge map.

### Prewitt

Convolution-based edge detection via scikit-image `prewitt` filter.

### Canny

Multi-stage optimal edge detector with hysteresis thresholding (low/high thresholds configurable).

## Genetic Algorithm

### Chromosome Representation

Binary edge mask of shape (H, W) where each gene is 0 (no edge) or 1 (edge pixel).

### Fitness Function

```
F = w1·gradient_score + w2·continuity_score + w3·thinness_score − w4·noise_penalty
```

| Component | Description |
|-----------|-------------|
| `gradient_score` | Mean gradient magnitude at edge pixels |
| `continuity_score` | Connected component analysis — rewards large coherent contours |
| `thinness_score` | Morphological thinning proxy — rewards single-pixel-width edges |
| `noise_penalty` | Isolated pixels in low-gradient regions |

Default weights: w1=0.35, w2=0.30, w3=0.20, w4=0.15

### GA Operators

| Operator | Implementation |
|----------|----------------|
| Initialization | 30% gradient-seeded + 70% random sparse masks |
| Selection | Tournament selection (size=3) |
| Crossover | Mask-based uniform crossover |
| Mutation | Local edge pixel shift + random flip |
| Elitism | Top N chromosomes preserved each generation |

### Generation Loop

```
for gen in range(generations):
    evaluate fitness
    record best/avg fitness
    elitism → preserve top K
    while population not full:
        tournament select parents
        crossover
        mutate
    replace population
return best chromosome
```

## Evaluation Metrics

- **Edge density** — ratio of edge pixels to total pixels
- **Continuity score** — from fitness module
- **Noise score** — isolated pixel penalty
- **Fitness score** — GA fitness (GA runs only)
- **Runtime** — execution time in milliseconds

## Comparison Mode

`compare_all` runs Sobel, Prewitt, Canny, and GA on the same preprocessed image, enabling side-by-side scientific comparison.

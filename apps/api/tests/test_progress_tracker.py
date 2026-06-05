from app.services.progress_tracker import ExperimentProgressTracker, compute_total_steps


def test_compute_total_steps_compare_all():
    total = compute_total_steps(["sobel", "prewitt", "canny", "genetic"], ga_generations=30)
    assert total == 1 + 3 + 30


def test_ga_generation_progress_is_real_not_fake():
    tracker = ExperimentProgressTracker(["genetic"], ga_generations=10)
    tracker.complete_preprocessing()
    p0, g0 = tracker.record_ga_generation(0)
    p4, g4 = tracker.record_ga_generation(4)
    p9, g9 = tracker.record_ga_generation(9)
    assert g0 == 1
    assert g4 == 5
    assert g9 == 10
    assert p0 < p4 < p9
    assert p9 < 100.0
    final, _ = tracker.complete_ga()
    assert final == 100.0


def test_classical_only_progress():
    tracker = ExperimentProgressTracker(["sobel"], ga_generations=30)
    prep, _ = tracker.complete_preprocessing()
    done, _ = tracker.complete_classical_algorithm()
    assert prep < done == 100.0

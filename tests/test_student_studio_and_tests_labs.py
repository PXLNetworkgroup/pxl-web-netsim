import sys
import os
import json
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8080"

def run_tests():
    print("=== STARTING STUDENT STUDIO & TEST/LAB DISTINCTION TESTS ===")
    
    # 1. Login as teacher
    teacher_sess = requests.Session()
    res = teacher_sess.post(f"{BASE_URL}/api/auth/login", json={"username": "teacher", "password": "SinterklaasOp6December"})
    assert res.status_code == 200, f"Teacher login failed: {res.text}"
    t_data = res.json()
    assert t_data["user"]["role"] == "teacher"
    print("✓ 1. Teacher login verified")

    # 2. Teacher assigns a practice lab to 1TIN-A
    res = teacher_sess.post(f"{BASE_URL}/api/teacher/exam/assign-targets", json={
        "exam_id": "01_pxl_standard",
        "title": "LAN Routing Oefenlab",
        "targets": [{"type": "class", "value": "1TIN-A", "class": "1TIN-A"}],
        "time_limit_minutes": 60,
        "is_active": True,
        "assignment_type": "lab",
        "test_password": "",
        "is_started": 1
    })
    assert res.status_code == 200, f"Assign lab failed: {res.text}"
    print("✓ 2. Practice Lab assigned to class 1TIN-A")

    # 3. Teacher assigns an official test to 1TIN-A with password and initially NOT started (is_started=0)
    res = teacher_sess.post(f"{BASE_URL}/api/teacher/exam/assign-targets", json={
        "exam_id": "02_cabling_scratch",
        "title": "Bekabelen Examen Test",
        "targets": [{"type": "class", "value": "1TIN-A", "class": "1TIN-A"}],
        "time_limit_minutes": 45,
        "is_active": True,
        "assignment_type": "test",
        "test_password": "PXL-SECRET-PASS",
        "is_started": 0
    })
    assert res.status_code == 200, f"Assign test failed: {res.text}"
    print("✓ 3. Official Test assigned to class 1TIN-A (is_started=0, test_password=PXL-SECRET-PASS)")

    # 4. Check teacher assignments table
    res = teacher_sess.get(f"{BASE_URL}/api/teacher/exam/assignments")
    assert res.status_code == 200
    assignments = res.json().get("assignments", [])
    test_asg = next((a for a in assignments if a["exam_id"] == "02_cabling_scratch"), None)
    lab_asg = next((a for a in assignments if a["exam_id"] == "01_pxl_standard"), None)
    assert test_asg is not None, "Test assignment not found in assignments"
    assert test_asg["assignment_type"] == "test"
    assert test_asg["is_started"] == 0
    assert test_asg["test_password"] == "PXL-SECRET-PASS"
    print("✓ 4. Teacher assignments verified in database with correct type and password")

    # 5. Login as student1 (belongs to 1TIN-A)
    student_sess = requests.Session()
    res = student_sess.post(f"{BASE_URL}/api/auth/login", json={"username": "student1", "password": "PXL2026!"})
    assert res.status_code == 200, f"Student login failed: {res.text}"
    s_data = res.json()
    assert s_data["user"]["role"] == "student"
    assert s_data["user"]["class_group"] == "1TIN-A"
    print("✓ 5. Student1 login verified (role=student)")

    # 6. Student gets assigned exams
    res = student_sess.get(f"{BASE_URL}/api/student/assigned-exams")
    assert res.status_code == 200
    st_exams = res.json().get("exams", [])
    st_lab = next((e for e in st_exams if e["exam_id"] == "01_pxl_standard"), None)
    st_test = next((e for e in st_exams if e["exam_id"] == "02_cabling_scratch"), None)
    assert st_lab is not None, "Assigned lab missing for student1"
    assert st_test is not None, "Assigned test missing for student1"
    assert st_lab["assignment_type"] == "lab"
    assert st_test["assignment_type"] == "test"
    assert st_test["is_started"] == False
    assert st_test["has_password"] == True
    print("✓ 6. Student1 sees assigned lab and test with started=False and has_password=True")

    # 7. Student tries to verify password while test is not started -> should fail!
    res = student_sess.post(f"{BASE_URL}/api/student/verify-test-password", json={
        "exam_id": "02_cabling_scratch",
        "password": "PXL-SECRET-PASS"
    })
    assert res.status_code == 200
    assert res.json().get("ok") == False
    assert "nog niet gestart" in res.json().get("error", "").lower()
    print("✓ 7. Test locked: student access blocked before teacher starts test")

    # 8. Teacher toggles test start to True
    res = teacher_sess.post(f"{BASE_URL}/api/teacher/exam/assignment/toggle-start", json={
        "id": test_asg["id"],
        "is_started": True
    })
    assert res.status_code == 200
    print("✓ 8. Teacher toggled test start to ON")

    # 9. Student tries with wrong password -> should fail
    res = student_sess.post(f"{BASE_URL}/api/student/verify-test-password", json={
        "exam_id": "02_cabling_scratch",
        "password": "WRONG_PASSWORD"
    })
    assert res.status_code == 200
    assert res.json().get("ok") == False
    assert "onjuist" in res.json().get("error", "").lower()
    print("✓ 9. Test password enforcement: wrong password correctly rejected")

    # 10. Student enters correct password -> should succeed!
    res = student_sess.post(f"{BASE_URL}/api/student/verify-test-password", json={
        "exam_id": "02_cabling_scratch",
        "password": "PXL-SECRET-PASS"
    })
    assert res.status_code == 200
    assert res.json().get("ok") == True
    print("✓ 10. Test password accepted: access granted to test")

    # 11. Student saves progress on lab with rubric evaluation details
    rubric_sample = [
        {"id": "ip_pc1", "title": "IP Adres PC1", "passed": True, "points": 10, "detail": "192.168.1.10 correct"},
        {"id": "def_gw", "title": "Default Gateway", "passed": False, "points": 10, "detail": "Geen gateway geconfigureerd"}
    ]
    res = student_sess.post(f"{BASE_URL}/api/student/save", json={
        "exam_id": "01_pxl_standard",
        "topology": {"devices": []},
        "running_config": {},
        "rubric_evaluation": rubric_sample,
        "score": 10,
        "max_score": 20,
        "percentage": 50.0
    })
    assert res.status_code == 200
    print("✓ 11. Student progress and rubric evaluation persisted")

    # 12. Student fetches assigned exams -> sees score and rubric details ("wat hij niet goed had")
    res = student_sess.get(f"{BASE_URL}/api/student/assigned-exams")
    assert res.status_code == 200
    st_exams = res.json().get("exams", [])
    st_lab = next((e for e in st_exams if e["exam_id"] == "01_pxl_standard"), None)
    assert st_lab["score"] == 10
    assert st_lab["percentage"] == 50.0
    assert len(st_lab["rubric_evaluation"]) == 2
    failed_items = [r for r in st_lab["rubric_evaluation"] if not r["passed"]]
    assert len(failed_items) == 1
    assert failed_items[0]["title"] == "Default Gateway"
    print("✓ 12. Rubric error breakdown successfully retrieved for student inspection")

    # 13. Student tries to reset official TEST -> MUST BE BLOCKED!
    # Also save something to the test first
    student_sess.post(f"{BASE_URL}/api/student/save", json={
        "exam_id": "02_cabling_scratch",
        "topology": {},
        "score": 20,
        "max_score": 20,
        "percentage": 100.0
    })
    res = student_sess.post(f"{BASE_URL}/api/student/reset-lab", json={"exam_id": "02_cabling_scratch"})
    assert res.status_code == 400
    assert res.json().get("ok") == False
    assert "docent" in res.json().get("error", "").lower()
    print("✓ 13. Student blocked from resetting official test ('Enkel docent kan resetten')")

    # 14. Student resets practice LAB -> SUCCEEDS!
    res = student_sess.post(f"{BASE_URL}/api/student/reset-lab", json={"exam_id": "01_pxl_standard"})
    assert res.status_code == 200
    assert res.json().get("ok") == True
    # Verify save is cleared
    res = student_sess.get(f"{BASE_URL}/api/student/load?exam_id=01_pxl_standard")
    assert res.status_code == 200
    assert res.json().get("found") == False
    print("✓ 14. Student self-reset of practice lab succeeded")

    # 15. Student changes password
    res = student_sess.post(f"{BASE_URL}/api/student/change-password", json={
        "old_password": "WRONG_OLD_PW",
        "new_password": "NewSecret2026!"
    })
    assert res.status_code == 400
    assert "onjuist" in res.json().get("error", "").lower()
    print("✓ 15a. Password change rejected with wrong current password")

    res = student_sess.post(f"{BASE_URL}/api/student/change-password", json={
        "old_password": "PXL2026!",
        "new_password": "NewSecret2026!"
    })
    assert res.status_code == 200
    assert res.json().get("ok") == True
    print("✓ 15b. Password successfully changed by student")

    # Verify login with new password
    new_sess = requests.Session()
    res = new_sess.post(f"{BASE_URL}/api/auth/login", json={"username": "student1", "password": "NewSecret2026!"})
    assert res.status_code == 200
    print("✓ 15c. Login with new password succeeded")

    # Revert password back to PXL2026!
    res = new_sess.post(f"{BASE_URL}/api/student/change-password", json={
        "old_password": "NewSecret2026!",
        "new_password": "PXL2026!"
    })
    assert res.status_code == 200
    print("✓ 15d. Password reverted back to default for test repeatability")

    print("\n🎉 ALL STUDENT STUDIO & TEST/LAB BACKEND INTEGRATION TESTS PASSED!")

if __name__ == "__main__":
    run_tests()

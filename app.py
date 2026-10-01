import os
import joblib
import pandas as pd

from flask import Flask, render_template, request, jsonify


app = Flask(__name__)


# ============================================================
# MODEL CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "saved_models",
    "lung_disease_stacking_system.pkl"
)


# ============================================================
# LOAD SAVED MODEL SYSTEM
# ============================================================

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Model bundle was not found at: {MODEL_PATH}"
    )

model_system = joblib.load(MODEL_PATH)


# ============================================================
# MODEL COMPONENTS
# ============================================================

imputer = model_system["imputer"]

random_forest = model_system["random_forest"]

svm = model_system["svm"]
svm_scaler = model_system["svm_scaler"]

xgboost_model = model_system["xgboost"]

mlp = model_system["mlp"]
mlp_scaler = model_system["mlp_scaler"]

meta_learner = model_system["meta_learner"]

selected_features = model_system["selected_features"]

stacking_feature_order = model_system["stacking_feature_order"]

decision_threshold = model_system["decision_threshold"]


# ============================================================
# EXPECTED FEATURE ORDER
# ============================================================

EXPECTED_FEATURES = [
    "FEV1 Pre-BD Value",
    "FEV1 Pre-BD Pred",
    "FEV1 Post-BD Value",
    "FEV1 Post-BD Pred",
    "FVC Pre-BD Value",
    "FVC Pre-BD Pred",
    "FVC Post-BD Value",
    "FVC Post-BD Pred",
    "FEF Pre-BD Value",
    "FEF Pre-BD Pred",
    "FEF Post-BD Value",
    "FEF Post-BD Pred",
]


# ============================================================
# MODEL INTEGRITY CHECK
# ============================================================

if list(selected_features) != EXPECTED_FEATURES:
    raise ValueError(
        "Saved model feature order does not match "
        "the expected application feature order."
    )


# ============================================================
# PREDICTION FUNCTION
# ============================================================

def predict_patient(patient_data):

    # Create DataFrame in the exact training feature order
    input_df = pd.DataFrame(
        [patient_data],
        columns=selected_features
    )

    # --------------------------------------------------------
    # 1. IMPUTATION
    # --------------------------------------------------------

    X_imputed = imputer.transform(input_df)

    # --------------------------------------------------------
    # 2. RANDOM FOREST
    # --------------------------------------------------------

    rf_probability = random_forest.predict_proba(
        X_imputed
    )[0, 1]

    # --------------------------------------------------------
    # 3. SVM
    # --------------------------------------------------------

    X_svm = svm_scaler.transform(X_imputed)

    svm_probability = svm.predict_proba(
        X_svm
    )[0, 1]

    # --------------------------------------------------------
    # 4. XGBOOST
    # --------------------------------------------------------

    xgb_probability = xgboost_model.predict_proba(
        X_imputed
    )[0, 1]

    # --------------------------------------------------------
    # 5. MLP
    # --------------------------------------------------------

    X_mlp = mlp_scaler.transform(X_imputed)

    mlp_probability = mlp.predict_proba(
        X_mlp
    )[0, 1]

    # --------------------------------------------------------
    # 6. STACKING FEATURES
    # --------------------------------------------------------

    stacking_data = pd.DataFrame(
        [[
            rf_probability,
            svm_probability,
            xgb_probability,
            mlp_probability
        ]],
        columns=[
            "Random_Forest_Probability",
            "SVM_Probability",
            "XGBoost_Probability",
            "MLP_Probability"
        ]
    )

    # Preserve exact Stage 11 stacking feature order
    stacking_data = stacking_data[
        stacking_feature_order
    ]

    # --------------------------------------------------------
    # 7. META-LEARNER
    # --------------------------------------------------------

    ensemble_probability = meta_learner.predict_proba(
        stacking_data
    )[0, 1]

    # --------------------------------------------------------
    # 8. FINAL CLASSIFICATION
    # --------------------------------------------------------

    final_prediction = int(
        ensemble_probability >= decision_threshold
    )

    classification = (
        "Obstructive"
        if final_prediction == 1
        else "Non-obstructive"
    )

    return {
        "prediction": final_prediction,
        "classification": classification,

        "ensemble_probability": float(
            ensemble_probability
        ),

        "base_probabilities": {
            "Random Forest": float(rf_probability),
            "SVM": float(svm_probability),
            "XGBoost": float(xgb_probability),
            "MLP": float(mlp_probability)
        }
    }


# ============================================================
# HOME ROUTE
# ============================================================

@app.route("/")
def home():

    return render_template(
        "index.html",
        model_loaded=True,
        feature_count=len(selected_features)
    )


# ============================================================
# PREDICTION ROUTE
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    try:
        data = request.get_json()

        if data is None:
            return jsonify({
                "success": False,
                "error": "No patient data was received."
            }), 400

        patient_data = {}

        for feature in selected_features:

            if feature not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing input: {feature}"
                }), 400

            try:
                value = float(data[feature])

                if value < 0:
                    return jsonify({
                        "success": False,
                        "error": (
                            f"{feature} cannot be negative."
                        )
                    }), 400

                patient_data[feature] = value

            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "error": (
                        f"Invalid numerical value for "
                        f"{feature}"
                    )
                }), 400

        result = predict_patient(patient_data)

        return jsonify({
            "success": True,
            **result
        })

    except Exception as error:

        print(f"Prediction error: {error}")

        return jsonify({
            "success": False,
            "error": "Prediction could not be completed."
        }), 500


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":
    print("\nLung Disease Classification System")
    print("----------------------------------")
    print("Model bundle loaded successfully.")
    print(f"Number of input features: {len(selected_features)}")
    print(f"Decision threshold: {decision_threshold}")
    print("----------------------------------\n")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
import axios from "axios";

const BDD_SERVICE_URL = process.env.BDD_SERVICE_URL;
console.log(BDD_SERVICE_URL);

export const updateUserToPremium = async (userId: string, token: string) => {
  console.log(userId);
  try {
    const userRes = await axios.get(`${BDD_SERVICE_URL}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const currentCount = userRes.data?.user?.aiUsageCount ?? 0;
    console.log(currentCount);
    const response = await axios.put(
      `${BDD_SERVICE_URL}/users/${userId}`,
      { isPremium: true, aiUsageCount: currentCount + 20 },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response);
    return response.data;
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour de l'utilisateur en premium:",
      error
    );
    if (axios.isAxiosError(error)) {
      console.error("Détails de l'erreur:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }
    throw error;
  }
};

export const removeUserFromPremium = async (userId: string, token: string) => {
  try {
    const response = await axios.put(
      `${BDD_SERVICE_URL}/users/${userId}`,
      { isPremium: false },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Erreur lors de la suppression du statut premium:", error);
    if (axios.isAxiosError(error)) {
      console.error("Détails de l'erreur:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }
    throw error;
  }
};

export const updateUserSubscriptionId = async (
  userId: string,
  subscriptionId: string,
  token: string
) => {
  try {
    const response = await axios.put(
      `${BDD_SERVICE_URL}/users/${userId}`,
      { stripeSubscriptionId: subscriptionId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'ID d'abonnement:", error);
    throw error;
  }
};

export const getUserById = async (userId: string, token: string) => {
  try {
    const response = await axios.get(`${BDD_SERVICE_URL}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'utilisateur:", error);
    throw error;
  }
};
